import type { PlaybackVoice } from './types';

interface KokoroRuntimeOverride {
  device?: 'webgpu' | 'wasm';
  dtype?: string;
}

export type KokoroWorkerRequestPayload =
  | ({ type: 'initialize'; debug?: boolean } & KokoroRuntimeOverride)
  | { type: 'synthesize'; text: string; voiceId: string; speed: number; priority: 'play' | 'preload'; debug?: boolean };

export type KokoroWorkerRequest =
  | ({ id: number; type: 'initialize'; debug?: boolean } & KokoroRuntimeOverride)
  | {
      id: number;
      type: 'synthesize';
      text: string;
      voiceId: string;
      speed: number;
      priority: 'play' | 'preload';
      debug?: boolean;
    };

export type KokoroWorkerResponse =
  | { id: number; type: 'initialized'; voices: PlaybackVoice[]; runtime: 'webgpu' | 'wasm'; dtype?: string }
  | { id: number; type: 'synthesized'; audio: ArrayBuffer; sampleRate: number }
  | { id: number; type: 'error'; error: string }
  | { id: number; type: 'load-progress'; progress: number | null };
