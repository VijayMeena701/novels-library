"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { PlaybackManager } from "@/lib/tts/playback";
import type {
PlaybackConfig,
PlaybackEngineName,
PlaybackState,
PlaybackVoice,
} from "@/lib/tts/playback";

export interface UsePlaybackManagerOptions {
engineName: PlaybackEngineName;
config: PlaybackConfig;
}

export interface UsePlaybackManagerReturn {
play: (text: string, callbacks: { onStart?: () => void; onEnd?: () => void; onBoundary?: (event: { name: "word" | "sentence" | ""; charIndex: number; charLength?: number }) => void; onError?: (error: string) => void }) => void;
preload: (text: string) => void;
speakKeepAlive: (text: string) => void;
pause: () => void;
resume: () => void;
stop: () => void;
state: PlaybackState;
voices: PlaybackVoice[];
isSupported: boolean;
engineName: PlaybackEngineName;
}

function getServerVersion() {
return 0;
}

export function usePlaybackManager({ engineName, config }: UsePlaybackManagerOptions): UsePlaybackManagerReturn {
// eslint-disable-next-line react-hooks/exhaustive-deps
const manager = useMemo(() => new PlaybackManager(engineName, config), [engineName]);

const subscribe = useCallback(
(onChange: () => void) => {
const listener = () => onChange();
manager.addEventListener("change", listener);
void manager.initialize();
return () => {
manager.removeEventListener("change", listener);
manager.destroy();
};
},
[manager],
);

const getSnapshot = useCallback(() => manager.version, [manager]);

// The version is used only to force re-renders when the manager emits change events.
const _version = useSyncExternalStore(subscribe, getSnapshot, getServerVersion);
void _version;

useEffect(() => {
manager.updateConfig(config);
}, [manager, config]);

const actions = useMemo(
() => ({
play: (text: string, callbacks: { onStart?: () => void; onEnd?: () => void; onBoundary?: (event: { name: "word" | "sentence" | ""; charIndex: number; charLength?: number }) => void; onError?: (error: string) => void }) => manager.play(text, callbacks),
preload: (text: string) => manager.preload(text),
speakKeepAlive: (text: string) => manager.speakKeepAlive(text),
pause: () => manager.pause(),
resume: () => manager.resume(),
stop: () => manager.stop(),
}),
[manager],
);

return {
...actions,
state: manager.state,
voices: manager.getVoices(),
isSupported: manager.isSupported,
engineName: manager.engineName,
};
}
