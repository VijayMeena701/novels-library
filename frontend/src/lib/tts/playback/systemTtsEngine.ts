import type {
  PlaybackBoundaryEvent,
  PlaybackConfig,
  PlaybackEngine,
  PlaybackEngineCallbacks,
  PlaybackState,
  PlaybackVoice,
} from './types';

export class SystemTTSEngine implements PlaybackEngine {
  readonly name = 'system' as const;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private _voices: SpeechSynthesisVoice[] = [];
  private _state: PlaybackState = 'idle';
  private voicesChangedHandler: (() => void) | null = null;
  private initResolve: (() => void) | null = null;
  onVoicesChanged?: (() => void) | null = null;

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  async initialize(): Promise<void> {
    if (!this.isSupported || typeof window === 'undefined') {
      this._state = 'idle';
      return;
    }

    return new Promise<void>((resolve) => {
      this.initResolve = resolve;

      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;

        this._voices = voices;
        this.onVoicesChanged?.();

        if (this.initResolve) {
          this.initResolve();
          this.initResolve = null;
        }
      };

      this.voicesChangedHandler = updateVoices;
      window.speechSynthesis.onvoiceschanged = updateVoices;
      updateVoices();
    });
  }

  destroy(): void {
    if (this.isSupported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      if (this.voicesChangedHandler) {
        window.speechSynthesis.onvoiceschanged = null;
        this.voicesChangedHandler = null;
      }
    }
    this.onVoicesChanged = null;
    this.initResolve = null;
    this.activeUtterance = null;
  }

  getVoices(): PlaybackVoice[] {
    return this._voices.map((voice) => ({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
    }));
  }

  getState(): PlaybackState {
    return this._state;
  }

  private applyConfig(utterance: SpeechSynthesisUtterance, config: PlaybackConfig): void {
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    const selectedVoice = this._voices.find((voice) => voice.voiceURI === config.voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  play(text: string, config: PlaybackConfig, callbacks: PlaybackEngineCallbacks): void {
    if (!this.isSupported || typeof window === 'undefined') {
      callbacks.onError?.('Text to speech is not available in this browser.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.applyConfig(utterance, config);

    utterance.onstart = () => {
      if (this.activeUtterance !== utterance) return;
      this._state = 'playing';
      callbacks.onStart?.();
    };

    utterance.onend = () => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this._state = 'idle';
      callbacks.onEnd?.();
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (this.activeUtterance !== utterance) return;
      const boundaryEvent: PlaybackBoundaryEvent = {
        name: (event.name as PlaybackBoundaryEvent['name']) || 'word',
        charIndex: event.charIndex ?? 0,
      };
      callbacks.onBoundary?.(boundaryEvent);
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this._state = 'error';
      callbacks.onError?.(event.error);
    };

    this.activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /** Play text without tracking callbacks. Used for keep-alive chirps. */
  speakKeepAlive(text: string, config: PlaybackConfig): void {
    if (!this.isSupported || typeof window === 'undefined') return;

    const utterance = new SpeechSynthesisUtterance(text);
    this.applyConfig(utterance, config);
    this.activeUtterance = null;
    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if (!this.isSupported || typeof window === 'undefined') return;
    window.speechSynthesis.pause();
    if (this._state === 'playing') this._state = 'paused';
  }

  resume(): void {
    if (!this.isSupported || typeof window === 'undefined') return;
    window.speechSynthesis.resume();
    if (this._state === 'paused') this._state = 'playing';
  }

  stop(): void {
    if (!this.isSupported || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    this.activeUtterance = null;
    this._state = 'idle';
  }

  setPlaybackRate(rate: number): void {
    // System TTS applies the rate on each new utterance.
    void rate;
  }

  setVoice(voiceURI: string): void {
    // System TTS applies the voice on each new utterance.
    void voiceURI;
  }
}
