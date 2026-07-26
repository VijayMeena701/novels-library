import { SystemTTSEngine } from "./systemTtsEngine";
import { CloudAIEngine } from "./cloudAiEngine";
import type {
    PlaybackConfig,
    PlaybackEngine,
    PlaybackEngineCallbacks,
    PlaybackEngineName,
    PlaybackState,
    PlaybackVoice,
} from "./types";

export async function createPlaybackEngine(name: PlaybackEngineName): Promise<PlaybackEngine> {
    switch (name) {
        case "local": {
            const { LocalAIEngine } = await import("./localAiEngine");
            return new LocalAIEngine();
        }
        case "cloud":
            return new CloudAIEngine();
        case "system":
        default:
            return new SystemTTSEngine();
    }
}

/**
 * Coordinates reader TTS requests with the active playback engine. The reader
 * never talks to SpeechSynthesis or any engine directly; it talks to this manager.
 *
 * The manager exposes a numeric `version` that increments whenever its state,
 * voice list, or availability changes. UI code can subscribe by observing the
 * version in `useSyncExternalStore`.
 */
export class PlaybackManager extends EventTarget {
    private _engineName: PlaybackEngineName;
    private engine: PlaybackEngine | null = null;
    private config: PlaybackConfig;
    private _version = 0;
    private _voices: PlaybackVoice[] = [];
    private initPromise: Promise<void> | null = null;

    constructor(engineName: PlaybackEngineName, config: PlaybackConfig) {
        super();
        this._engineName = engineName;
        this.config = config;
    }

    get version(): number {
        return this._version;
    }

    get engineName(): PlaybackEngineName {
        return this.engine?.name ?? this._engineName;
    }

    get state(): PlaybackState {
        return this.engine?.getState() ?? "idle";
    }

    get isSupported(): boolean {
        return this.engine?.isSupported ?? false;
    }

    getVoices(): PlaybackVoice[] {
        return this._voices;
    }

    private notify(): void {
        this._version++;
        this.dispatchEvent(new CustomEvent("change", { detail: this.state }));
    }

    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;
        this.initPromise = (async () => {
            try {
                this.engine = await createPlaybackEngine(this._engineName);
                this.engine.onVoicesChanged = () => {
                    this._voices = this.engine!.getVoices();
                    this.notify();
                };
                await this.engine.initialize();
                this.engine.setPlaybackRate(this.config.rate);
                this.engine.setVoice(this.config.voiceURI);
                this._voices = this.engine.getVoices();
            } catch {
                this.engine = null;
                this._voices = [];
            } finally {
                this.notify();
            }
        })();
        return this.initPromise;
    }

    destroy(): void {
        if (this.engine) {
            this.engine.destroy();
        }
        this.engine = null;
        this.initPromise = null;
        this.notify();
    }

    updateConfig(config: Partial<PlaybackConfig>): void {
        this.config = { ...this.config, ...config };
        if (this.engine) {
            this.engine.setPlaybackRate(this.config.rate);
            this.engine.setVoice(this.config.voiceURI);
        }
    }

    play(text: string, callbacks: PlaybackEngineCallbacks): void {
        if (!this.engine) return;
        const wrappedCallbacks: PlaybackEngineCallbacks = {
            onStart: () => {
                this.notify();
                callbacks.onStart?.();
            },
            onEnd: () => {
                this.notify();
                callbacks.onEnd?.();
            },
            onBoundary: callbacks.onBoundary,
            onError: (error) => {
                this.notify();
                callbacks.onError?.(error);
            },
        };

        this.engine.play(text, this.config, wrappedCallbacks);
        this.notify();
    }

    preload(text: string): void {
        if (this.engine && typeof this.engine.preload === "function") {
            this.engine.preload(text, this.config);
        }
    }

    speakKeepAlive(text: string): void {
        if (!this.engine) return;
        if (
            "speakKeepAlive" in this.engine &&
            typeof (this.engine as { speakKeepAlive?: (text: string, config: PlaybackConfig) => void }).speakKeepAlive === "function"
        ) {
            (this.engine as { speakKeepAlive: (text: string, config: PlaybackConfig) => void }).speakKeepAlive(text, this.config);
        } else {
            this.engine.play(text, this.config, {});
        }
        this.notify();
    }

    pause(): void {
        if (this.engine) this.engine.pause();
        this.notify();
    }

    resume(): void {
        if (this.engine) this.engine.resume();
        this.notify();
    }

    stop(): void {
        if (this.engine) this.engine.stop();
        this.notify();
    }
}
