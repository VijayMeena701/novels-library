import type { PlaybackConfig, PlaybackEngine, PlaybackEngineCallbacks, PlaybackState, PlaybackVoice } from './types';

/**
 * Placeholder for a future Cloud AI TTS engine. It exists so the reader and
 * manager already know how to route to it; playback simply reports it is not ready.
 */
export class CloudAIEngine implements PlaybackEngine {
  readonly name = 'cloud' as const;

  get isSupported(): boolean {
    return false;
  }

  async initialize(): Promise<void> {
    // Cloud AI is intentionally not implemented in this refactor.
  }

  destroy(): void {
    // No resources to release.
  }

  getVoices(): PlaybackVoice[] {
    return [];
  }

  getState(): PlaybackState {
    return 'idle';
  }

  play(_text: string, _config: PlaybackConfig, callbacks: PlaybackEngineCallbacks): void {
    callbacks.onError?.('Cloud AI TTS is coming soon.');
  }

  pause(): void {
    // No-op.
  }

  resume(): void {
    // No-op.
  }

  stop(): void {
    // No-op.
  }

  setPlaybackRate(rate: number): void {
    void rate;
  }

  setVoice(voiceURI: string): void {
    void voiceURI;
  }
}
