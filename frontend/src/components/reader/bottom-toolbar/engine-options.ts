import type { PlaybackEngineName } from "../../../lib/tts/playback";

export interface EngineOption {
	value: PlaybackEngineName;
	label: string;
	disabled?: boolean;
}

export const ENGINE_OPTIONS: EngineOption[] = [
	{ value: "system", label: "System TTS" },
	{ value: "local", label: "Local AI TTS" },
	{ value: "cloud", label: "Cloud AI TTS — Coming Soon", disabled: true },
];
