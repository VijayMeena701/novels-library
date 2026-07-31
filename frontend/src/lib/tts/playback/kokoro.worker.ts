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
let forcedDevice: 'webgpu' | 'wasm' | null = null;
let forcedDtype: string | null = null;

type DeviceClass = 'dgpu' | 'constrained' | 'software';

const MOBILE_UA_PATTERN = /android|iphone|ipad|ipod|mobile/i;

function isMobileDevice(): boolean {
  return MOBILE_UA_PATTERN.test(navigator.userAgent ?? '');
}

function classifyAdapter(info: GPUAdapterInfoLike): DeviceClass {
  const haystack = `${info.vendor ?? ''} ${info.architecture ?? ''} ${info.description ?? ''}`.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software/.test(haystack)) return 'software';
  if (isMobileDevice()) return 'constrained';
  if (/nvidia|geforce|rtx|gtx|amd|radeon/.test(haystack)) return 'dgpu';
  // Unknown/integrated GPUs get the conservative path to avoid freezing the device.
  return 'constrained';
}

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

function pickWebGpuDtypes(deviceClass: DeviceClass): string[] {
  // kokoro-js recommends fp32 for WebGPU, but fp32 weights + shaders are heavy
  // enough to freeze integrated/mobile GPUs. Only use fp32 on known discrete GPUs.
  // fp16 / q4f16 can load successfully on adapters that report shader-f16 but may
  // generate a silent/invalid waveform, and uint8/q4 quantize aggressively enough
  // to sound robotic, so q8 is the preferred lower-bit fallback.
  if (deviceClass === 'dgpu') return ['fp32', 'q8', 'q4'];
  if (deviceClass === 'constrained') return ['q8', 'q4'];
  return [];
}

function configureWasmThreads(env: { backends: { onnx?: Record<string, unknown> } }): void {
  const onnxEnv = (env.backends.onnx ?? {}) as Record<string, unknown>;
  const wasmEnv = { ...((onnxEnv.wasm as Record<string, unknown>) ?? {}) };
  // transformers.js defaults to using every core, which starves the rest of the
  // device (especially on Android). Cap threads so inference stays background work.
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 4;
  wasmEnv.numThreads = Math.max(1, Math.min(isMobileDevice() ? 2 : 4, cores));
  onnxEnv.wasm = wasmEnv;
  env.backends.onnx = onnxEnv;
}

interface ModelLoadProgressEvent {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

const fileProgress = new Map<string, { loaded: number; total: number }>();

function reportLoadProgress(event: ModelLoadProgressEvent): void {
  const file = event.file ?? 'model';
  if (event.status === 'initiate') {
    post({ id: 0, type: 'load-progress', progress: null });
    return;
  }
  if (
    event.status === 'progress' &&
    typeof event.loaded === 'number' &&
    typeof event.total === 'number' &&
    event.total > 0
  ) {
    fileProgress.set(file, { loaded: event.loaded, total: event.total });
  } else if (event.status === 'done' && fileProgress.has(file)) {
    const entry = fileProgress.get(file)!;
    fileProgress.set(file, { loaded: entry.total, total: entry.total });
  } else {
    return;
  }

  let loaded = 0;
  let total = 0;
  for (const entry of fileProgress.values()) {
    loaded += entry.loaded;
    total += entry.total;
  }
  if (total <= 0) return;
  const percent = Math.min(99, Math.floor((loaded / total) * 100));
  post({ id: 0, type: 'load-progress', progress: percent });
}

async function tryLoadKokoro(KokoroTTS: unknown, dtype: string, device: string): Promise<KokoroInstance | null> {
  try {
    const factory = KokoroTTS as {
      from_pretrained: (
        modelId: string,
        options: { dtype: string; device: string; progress_callback?: (event: ModelLoadProgressEvent) => void },
      ) => Promise<unknown>;
    };
    return (await factory.from_pretrained(MODEL_ID, {
      dtype,
      device,
      progress_callback: reportLoadProgress,
    })) as KokoroInstance;
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

    configureWasmThreads(env);

    // Manual override (from initialize request) is tried first so a specific
    // device/dtype combo can be tested per-device.
    if (forcedDevice && forcedDtype) {
      if (forcedDevice === 'wasm' || gpu) {
        tts = await tryLoadKokoro(KokoroTTS, forcedDtype, forcedDevice);
        if (tts) {
          runtime = forcedDevice;
          currentDtype = forcedDtype;
          debugLog(`Kokoro loaded with forced ${forcedDevice}/${forcedDtype}`);
          return;
        }
        debugLog(`Forced ${forcedDevice}/${forcedDtype} failed, falling back to auto selection`);
      }
    }

    if (gpu && !webgpuFailed && forcedDevice !== 'wasm') {
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
        const deviceClass = classifyAdapter(info);
        debugLog(
          'WebGPU adapter:',
          info.vendor,
          info.architecture,
          info.description,
          'powerPreference:',
          powerPreference,
          'supportsF16:',
          adapter.features.has('shader-f16'),
          'deviceClass:',
          deviceClass,
        );

        const dtypes = pickWebGpuDtypes(deviceClass);

        if (dtypes.length > 0) {
          const onnxEnv = (env.backends.onnx ?? {}) as Record<string, unknown>;
          onnxEnv.webgpu = { ...((onnxEnv.webgpu as Record<string, unknown>) ?? {}), adapter, powerPreference };
          env.backends.onnx = onnxEnv;

          for (const dtype of dtypes) {
            tts = await tryLoadKokoro(KokoroTTS, dtype, 'webgpu');
            if (tts) {
              runtime = 'webgpu';
              currentDtype = dtype;
              debugLog(`Kokoro loaded on WebGPU with dtype=${dtype} (deviceClass=${deviceClass})`);
              return;
            }
          }
        } else {
          debugLog('Skipping WebGPU on software adapter');
        }
        webgpuFailed = true;
      }
    }

    const wasmDtypes = forcedDtype && forcedDevice !== 'webgpu' ? [forcedDtype, 'q8', 'q4'] : ['q8', 'q4'];
    for (const dtype of [...new Set(wasmDtypes)]) {
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
    forcedDevice = request.device === 'webgpu' || request.device === 'wasm' ? request.device : null;
    forcedDtype = typeof request.dtype === 'string' && request.dtype.length > 0 ? request.dtype : null;
    if (forcedDevice || forcedDtype) {
      debugLog('Kokoro runtime override:', forcedDevice ?? 'auto', forcedDtype ?? 'auto');
    }
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
