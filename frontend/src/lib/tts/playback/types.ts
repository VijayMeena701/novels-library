export type PlaybackEngineName = "system" | "local" | "cloud";

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlaybackVoice {
	/** Stable identifier for the voice. */
	voiceURI: string;
	/** Human-readable voice label. */
	name: string;
	/** BCP-47 language tag (best-effort). */
	lang: string;
}

export interface PlaybackConfig {
	rate: number;
	pitch: number;
	voiceURI: string;
}

export interface PlaybackBoundaryEvent {
	name: "word" | "sentence" | "";
	/** Character index within the text passed to play(). */
	charIndex: number;
	charLength?: number;
}

export interface PlaybackEngineCallbacks {
	onStart?: () => void;
	onEnd?: () => void;
	onBoundary?: (event: PlaybackBoundaryEvent) => void;
	onError?: (error: string) => void;
}

export interface PlaybackEngine {
	readonly name: PlaybackEngineName;
	/** True when the runtime environment provides the APIs this engine needs. */
	readonly isSupported: boolean;
	/** One-time async setup (voice enumeration, model loading, etc.). */
	initialize(): Promise<void>;
	/** Release any held resources. */
	destroy(): void;
	/** Return the voices this engine can currently use. */
	getVoices(): PlaybackVoice[];
	/** Current playback lifecycle state. */
	getState(): PlaybackState;
	/** Start speaking text. */
	play(text: string, config: PlaybackConfig, callbacks: PlaybackEngineCallbacks): void;
	/** Synthesize upcoming text in the background so playback can start faster. */
	preload?(text: string, config: PlaybackConfig): void;
	/** Pause the currently playing utterance. */
	pause(): void;
	/** Resume a paused utterance. */
	resume(): void;
	/** Stop playback and cancel any pending audio. */
	stop(): void;
	/** Update the speaking rate for future play() calls (and live playback if supported). */
	setPlaybackRate(rate: number): void;
	/** Update the active voice for future play() calls. */
	setVoice(voiceURI: string): void;
}
