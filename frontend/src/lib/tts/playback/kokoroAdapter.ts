import type { PlaybackVoice } from './types';
import type { KokoroWorkerRequest, KokoroWorkerRequestPayload, KokoroWorkerResponse } from './kokoroWorkerProtocol';
import { isKokoroDebug, debugLog } from './kokoroDebug';

export interface LocalTTSModelSynthesizeOptions {
  voiceId: string;
  speed: number;
  priority: 'play' | 'preload';
}

export interface LocalTTSModelAdapter {
  readonly name: string;
  initialize(): Promise<void>;
  destroy(): void;
  getVoices(): PlaybackVoice[];
  synthesize(
    text: string,
    options: LocalTTSModelSynthesizeOptions,
  ): Promise<{ data: Float32Array; sampleRate: number }>;
}

interface PendingRequest {
  resolve: (response: KokoroWorkerResponse) => void;
  reject: (error: Error) => void;
}

const FALLBACK_VOICES: PlaybackVoice[] = [
  { voiceURI: 'af_heart', name: 'Heart', lang: 'en-US' },
  { voiceURI: 'af_bella', name: 'Bella', lang: 'en-US' },
  { voiceURI: 'af_nicole', name: 'Nicole', lang: 'en-US' },
  { voiceURI: 'am_adam', name: 'Adam', lang: 'en-US' },
  { voiceURI: 'am_michael', name: 'Michael', lang: 'en-US' },
  { voiceURI: 'bf_emma', name: 'Emma', lang: 'en-GB' },
  { voiceURI: 'bm_george', name: 'George', lang: 'en-GB' },
];

/**
 * Kokoro-specific adapter. This is the only module that imports `kokoro-js`,
 * keeping all model-specific logic isolated from the rest of the reader.
 */
export class KokoroAdapter implements LocalTTSModelAdapter {
  readonly name = 'kokoro';
  private worker: Worker | null = null;
  private voices: PlaybackVoice[] = [];
  private initPromise: Promise<void> | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;

  initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      throw new Error('Kokoro requires Web Worker support.');
    }

    this.worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleWorkerError);

    const response = await this.request({ type: 'initialize', debug: isKokoroDebug() });
    if (response.type !== 'initialized') {
      throw new Error('Kokoro worker returned an invalid initialization response.');
    }
    this.voices = response.voices.length > 0 ? response.voices : FALLBACK_VOICES;
  }

  private handleMessage = (event: MessageEvent<KokoroWorkerResponse>): void => {
    const response = event.data;
    if (response.type === 'synthesized') {
      debugLog('KokoroAdapter: received synthesized audio', {
        byteLength: response.audio.byteLength,
        sampleRate: response.sampleRate,
      });
    }
    const pending = this.pending.get(response.id);
    if (!pending) return;

    this.pending.delete(response.id);
    if (response.type === 'error') {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response);
    }
  };

  private handleWorkerError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'Kokoro worker failed.');
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  };

  private request(request: KokoroWorkerRequestPayload): Promise<KokoroWorkerResponse> {
    if (!this.worker) {
      return Promise.reject(new Error('Kokoro worker is not initialized.'));
    }

    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker?.postMessage({ ...request, id } as KokoroWorkerRequest);
    });
  }

  destroy(): void {
    this.worker?.removeEventListener('message', this.handleMessage);
    this.worker?.removeEventListener('error', this.handleWorkerError);
    this.worker?.terminate();
    this.worker = null;
    const error = new Error('Kokoro worker was terminated.');
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  getVoices(): PlaybackVoice[] {
    return this.voices;
  }

  async synthesize(
    text: string,
    options: LocalTTSModelSynthesizeOptions,
  ): Promise<{ data: Float32Array; sampleRate: number }> {
    await this.initialize();
    const response = await this.request({
      type: 'synthesize',
      text,
      voiceId: options.voiceId,
      speed: options.speed,
      priority: options.priority,
      debug: isKokoroDebug(),
    });
    if (response.type !== 'synthesized') {
      throw new Error('Kokoro worker returned an invalid synthesis response.');
    }
    const data = new Float32Array(response.audio);
    if (data.length > 0) {
      let min = data[0];
      let max = data[0];
      let zeroCount = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] as number;
        if (v < min) min = v;
        if (v > max) max = v;
        if (v === 0) zeroCount++;
      }
      debugLog('KokoroAdapter: Float32Array stats', {
        length: data.length,
        min,
        max,
        zeroCount,
        first20: Array.from(data.slice(0, 20)),
      });
    }
    return { data, sampleRate: response.sampleRate };
  }
}
