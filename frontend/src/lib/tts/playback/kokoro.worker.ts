/// <reference lib="webworker" />

import type { PlaybackVoice } from './types';
import type { KokoroWorkerRequest, KokoroWorkerResponse } from './kokoroWorkerProtocol';
import { debugLog, setKokoroDebug } from './kokoroDebug';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

type GPURequestAdapterOptions = { powerPreference?: 'high-performance' | 'low-power' };

type GPUAdapterInfoLike = {
  vendor?: string;
  architecture?: string;
  description?: string;
};

type GPUAdapterLike = {
  info?: GPUAdapterInfoLike;
  requestAdapterInfo?: () => Promise<GPUAdapterInfoLike>;
  features: { has: (feature: string) => boolean };
  limits: Record<string, number>;
  requestDevice: (descriptor?: unknown) => Promise<unknown>;
};

type GPULike = {
  requestAdapter: (options?: GPURequestAdapterOptions) => Promise<GPUAdapterLike | null>;
};

type KokoroRawAudio = {
  audio: Float32Array | ArrayLike<number>;
  sampling_rate?: number;
  sample_rate?: number;
};

type KokoroInstance = {
  voices?: Record<string, { name?: string; language?: string }>;
  generate: (text: string, options: { voice: string; speed: number }) => Promise<KokoroRawAudio>;
};

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let tts: KokoroInstance | null = null;
let runtime: 'webgpu' | 'wasm' = 'wasm';
let initializePromise: Promise<void> | null = null;

function formatVoiceName(id: string, baseName?: string): string {
  return (baseName ?? id).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

interface WaveformStats {
  length: number;
  min: number;
  max: number;
  zeroCount: number;
  nanCount: number;
  infCount: number;
  meanAbs: number;
  allZero: boolean;
}

function analyzeSamples(samples: Float32Array): WaveformStats {
  const length = samples.length;
  if (length === 0) {
    return { length: 0, min: 0, max: 0, zeroCount: 0, nanCount: 0, infCount: 0, meanAbs: 0, allZero: true };
  }

  let min = 0;
  let max = 0;
  let zeroCount = 0;
  let nanCount = 0;
  let infCount = 0;
  let sumAbs = 0;
  let foundFinite = false;
  let nonZeroFiniteCount = 0;

  for (let i = 0; i < length; i++) {
    const v = samples[i] as number;
    if (Number.isNaN(v)) {
      nanCount++;
      continue;
    }
    if (!Number.isFinite(v)) {
      infCount++;
      continue;
    }
    if (!foundFinite) {
      min = v;
      max = v;
      foundFinite = true;
    } else {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    sumAbs += Math.abs(v);
    if (v === 0) {
      zeroCount++;
    } else {
      nonZeroFiniteCount++;
    }
  }

  return {
    length,
    min,
    max,
    zeroCount,
    nanCount,
    infCount,
    meanAbs: foundFinite ? sumAbs / length : 0,
    allZero: nonZeroFiniteCount === 0 && nanCount === 0 && infCount === 0,
  };
}

function logWaveformStats(label: string, samples: Float32Array): void {
  const stats = analyzeSamples(samples);
  debugLog(
    `${label}:`,
    JSON.stringify({
      ...stats,
      first20: Array.from(samples.slice(0, 20)),
    }),
  );
}

function validateSamples(samples: Float32Array): void {
  const stats = analyzeSamples(samples);
  if (stats.length === 0) {
    throw new Error('Generated waveform is empty.');
  }
  if (stats.allZero) {
    throw new Error('Generated waveform is all zeros.');
  }
  if (stats.nanCount > 0) {
    throw new Error(`Generated waveform contains ${stats.nanCount} NaN values.`);
  }
  if (stats.infCount > 0) {
    throw new Error(`Generated waveform contains ${stats.infCount} Infinity values.`);
  }
}

function normalizeLang(lang: string): string {
  const lower = lang.toLowerCase();
  if (lower === 'en-gb') return 'en-GB';
  if (lower === 'en-us') return 'en-US';
  return lang;
}

function getVoices(): PlaybackVoice[] {
  const voiceMap = tts?.voices;
  if (!voiceMap) return [];

  return Object.entries(voiceMap).map(([id, metadata]) => ({
    voiceURI: id,
    name: formatVoiceName(id, metadata.name),
    lang: normalizeLang(metadata.language ?? (id.startsWith('b') ? 'en-gb' : 'en-us')),
  }));
}

let currentDtype = 'q8';
let webgpuFailed = false;

async function getAdapterInfo(adapter: GPUAdapterLike): Promise<GPUAdapterInfoLike> {
  if (adapter.info) return adapter.info;
  if (typeof adapter.requestAdapterInfo === 'function') {
    try {
      return await adapter.requestAdapterInfo();
    } catch {
      return {};
    }
  }
  return {};
}

function pickWebGpuDtypes(): string[] {
  // kokoro-js recommends fp32 for WebGPU. fp16 / q4f16 can load successfully
  // on adapters that report shader-f16 (e.g. NVIDIA discrete) but may generate
  // a silent/invalid waveform. Prefer fp32, then quantized fallbacks.
  return ['fp32', 'q8', 'uint8', 'q4'];
}

async function tryLoadKokoro(KokoroTTS: unknown, dtype: string, device: string): Promise<KokoroInstance | null> {
  try {
    const factory = KokoroTTS as {
      from_pretrained: (modelId: string, options: { dtype: string; device: string }) => Promise<unknown>;
    };
    return (await factory.from_pretrained(MODEL_ID, { dtype, device })) as KokoroInstance;
  } catch (error) {
    debugLog(`Kokoro load failed for ${device}/${dtype}:`, error);
    return null;
  }
}

async function loadModel(): Promise<void> {
  if (tts) return;
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    const { KokoroTTS } = await import('kokoro-js');
    const { env } = await import('@huggingface/transformers');
    const gpu = (navigator as unknown as { gpu?: GPULike }).gpu;

    if (gpu && !webgpuFailed) {
      let adapter: GPUAdapterLike | null = null;
      let powerPreference: 'high-performance' | 'low-power' = 'high-performance';

      try {
        adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) {
          powerPreference = 'low-power';
          adapter = await gpu.requestAdapter({ powerPreference: 'low-power' });
        }
      } catch (error) {
        debugLog('Failed to request WebGPU adapter:', error);
      }

      if (adapter) {
        const info = await getAdapterInfo(adapter);
        debugLog(
          'WebGPU adapter:',
          info.vendor,
          info.architecture,
          info.description,
          'powerPreference:',
          powerPreference,
          'supportsF16:',
          adapter.features.has('shader-f16'),
        );

        const onnxEnv = (env.backends.onnx ?? {}) as Record<string, unknown>;
        onnxEnv.webgpu = { ...((onnxEnv.webgpu as Record<string, unknown>) ?? {}), adapter, powerPreference };
        env.backends.onnx = onnxEnv;

        const dtypes = pickWebGpuDtypes();

        for (const dtype of dtypes) {
          tts = await tryLoadKokoro(KokoroTTS, dtype, 'webgpu');
          if (tts) {
            runtime = 'webgpu';
            currentDtype = dtype;
            debugLog(`Kokoro loaded on WebGPU with dtype=${dtype}`);
            return;
          }
        }
        webgpuFailed = true;
      }
    }

    for (const dtype of ['q8', 'q4']) {
      tts = await tryLoadKokoro(KokoroTTS, dtype, 'wasm');
      if (tts) {
        runtime = 'wasm';
        currentDtype = dtype;
        debugLog(`Kokoro loaded on WASM with dtype=${dtype}`);
        return;
      }
    }

    throw new Error('Unable to load Kokoro model on WebGPU or WASM.');
  })();

  try {
    await initializePromise;
  } catch (error) {
    initializePromise = null;
    throw error;
  }
}

function post(response: KokoroWorkerResponse, transfer?: Transferable[]): void {
  workerScope.postMessage(response, transfer ?? []);
}

const requestQueue: KokoroWorkerRequest[] = [];
let processing = false;

function takeNextRequest(): KokoroWorkerRequest | undefined {
  const playIndex = requestQueue.findIndex((request) => request.type === 'synthesize' && request.priority === 'play');
  if (playIndex >= 0) return requestQueue.splice(playIndex, 1)[0];
  return requestQueue.shift();
}

async function processRequest(request: KokoroWorkerRequest, isRetry = false): Promise<void> {
  try {
    await loadModel();

    if (request.type === 'initialize') {
      post({ id: request.id, type: 'initialized', voices: getVoices(), runtime, dtype: currentDtype });
      return;
    }

    if (!tts) throw new Error('Kokoro model is not initialized.');
    const result = await tts.generate(request.text, {
      voice: request.voiceId,
      speed: request.speed,
    });
    const raw = result.audio;
    if (!raw || typeof raw.length !== 'number' || raw.length === 0) {
      throw new Error('Kokoro generated audio did not contain samples.');
    }

    const samples = raw instanceof Float32Array ? raw : new Float32Array(raw);
    logWaveformStats('Kokoro worker model output', samples);
    validateSamples(samples);

    const audioBuffer =
      samples.buffer instanceof ArrayBuffer &&
      samples.byteOffset === 0 &&
      samples.byteLength === samples.buffer.byteLength
        ? samples.buffer
        : (samples.slice().buffer as ArrayBuffer);
    debugLog(
      'Kokoro worker transfer:',
      JSON.stringify({
        audioBufferByteLength: audioBuffer.byteLength,
        samplesLength: samples.length,
        sampleRate: result.sampling_rate ?? result.sample_rate ?? 24000,
      }),
    );
    post(
      {
        id: request.id,
        type: 'synthesized',
        audio: audioBuffer,
        sampleRate: result.sampling_rate ?? result.sample_rate ?? 24000,
      },
      [audioBuffer],
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isWebGpuRuntimeError = runtime === 'webgpu' && !isRetry;

    if (isWebGpuRuntimeError) {
      debugLog('WebGPU runtime error, falling back to WASM:', errorMessage);
      tts = null;
      initializePromise = null;
      webgpuFailed = true;
      return processRequest(request, true);
    }

    post({
      id: request.id,
      type: 'error',
      error: errorMessage,
    });
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    let request = takeNextRequest();
    while (request) {
      await processRequest(request);
      request = takeNextRequest();
    }
  } finally {
    processing = false;
  }
}

workerScope.addEventListener('message', (event: MessageEvent<KokoroWorkerRequest>) => {
  const request = event.data;
  setKokoroDebug(request.debug ?? false);
  if (request.type === 'initialize') {
    requestQueue.unshift(request);
  } else {
    requestQueue.push(request);
  }
  void processQueue();
});

workerScope.addEventListener('error', (event) => {
  console.error('Kokoro worker uncaught error:', event.message, event.error);
});

workerScope.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('Kokoro worker unhandled rejection:', event.reason);
  event.preventDefault();
});

export {};
