"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
api,
type User,
type ReaderSettings,
type ReaderWidth,
type ReaderHighlightMode,
type ReaderAutoScrollBehavior,
} from "../utils/api";
import { useReaderTheme } from "../context/ReaderThemeContext";
import { getTheme, type AppTheme } from "../design-system/themes";
import {
DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR,
DEFAULT_WORD_HIGHLIGHT_COLOR,
SPEECH_RATE_MIN,
SPEECH_RATE_MAX,
SPEECH_PITCH_MIN,
SPEECH_PITCH_MAX,
normalizeHexColor,
} from "../lib/reader-utils";
import type { PlaybackEngineName } from "@/lib/tts/playback";

function normalizePlaybackEngine(engine: PlaybackEngineName, allowLocalTts: boolean): PlaybackEngineName {
	if (engine === "local" && !allowLocalTts) return "system";
	return engine;
}

export interface UseReaderSettingsReturn {
theme: AppTheme;
onThemeChange: (theme: AppTheme) => void;
fontSize: number;
onFontSizeDecrease: () => void;
onFontSizeIncrease: () => void;
readWidth: ReaderWidth;
onReadWidthChange: (width: ReaderWidth) => void;
autoOpenNext: boolean;
onAutoOpenNextChange: (enabled: boolean) => void;
highlightMode: ReaderHighlightMode;
onHighlightModeChange: (mode: ReaderHighlightMode) => void;
highlightParagraph: boolean;
onHighlightParagraphChange: (enabled: boolean) => void;
useCustomHighlight: boolean;
onUseCustomHighlightChange: (enabled: boolean) => void;
paragraphColor: string;
onParagraphColorChange: (color: string) => void;
wordColor: string;
onWordColorChange: (color: string) => void;
sentenceHighlightOpacity: number;
onSentenceHighlightOpacityChange: (value: number) => void;
autoScrollDuringSpeech: boolean;
onAutoScrollDuringSpeechChange: (enabled: boolean) => void;
autoScrollBehavior: ReaderAutoScrollBehavior;
onAutoScrollBehaviorChange: (behavior: ReaderAutoScrollBehavior) => void;
autoScrollOffset: number;
onAutoScrollOffsetChange: (value: number) => void;
rate: number;
onRateChange: (rate: number) => void;
pitch: number;
onPitchChange: (pitch: number) => void;
voiceURI: string;
onVoiceChange: (voiceURI: string) => void;
playbackEngine: PlaybackEngineName;
onPlaybackEngineChange: (engine: PlaybackEngineName) => void;
speechPortalPosition: { x: number; y: number };
onPositionChange: (position: { x: number; y: number }, options?: { immediate?: boolean }) => void;
speechTogglePosition: { x: number; y: number };
onTogglePositionChange: (position: { x: number; y: number }) => void;
readerSettingsReady: boolean;
}

export function useReaderSettings(user: User | null, allowLocalTts = true): UseReaderSettingsReturn {
const { theme, setTheme: setReaderTheme } = useReaderTheme();
const [fontSize, setFontSize] = useState(18);
const [readWidth, setReadWidth] = useState<ReaderWidth>("narrow");
const [autoOpenNext, setAutoOpenNext] = useState(true);
const [highlightMode, setHighlightMode] = useState<ReaderHighlightMode>("paragraph");
const [highlightParagraph, setHighlightParagraph] = useState(true);
const [useCustomHighlight, setUseCustomHighlight] = useState(false);
const [paragraphHighlightColor, setParagraphHighlightColor] = useState(DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR);
const [wordHighlightColor, setWordHighlightColor] = useState(DEFAULT_WORD_HIGHLIGHT_COLOR);
const [sentenceHighlightOpacity, setSentenceHighlightOpacity] = useState(0.35);
const [autoScrollDuringSpeech, setAutoScrollDuringSpeech] = useState(true);
const [autoScrollBehavior, setAutoScrollBehavior] = useState<ReaderAutoScrollBehavior>("smooth");
const [autoScrollOffset, setAutoScrollOffset] = useState(140);
const [rate, setRate] = useState(1);
const [pitch, setPitch] = useState(1);
const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
const [playbackEngine, setPlaybackEngine] = useState<PlaybackEngineName>("system");
const [speechPortalPosition, setSpeechPortalPosition] = useState<{ x: number; y: number }>({ x: 20, y: 80 });
const [speechTogglePosition, setSpeechTogglePosition] = useState<{ x: number; y: number }>(() => {
if (typeof window === "undefined") return { x: 0, y: 0 };
try {
const saved = window.localStorage.getItem("books_reader_speech_toggle_position");
if (saved) {
const parsed = JSON.parse(saved) as unknown;
if (
parsed &&
typeof parsed === "object" &&
"x" in parsed &&
"y" in parsed &&
typeof (parsed as { x: unknown }).x === "number" &&
typeof (parsed as { y: unknown }).y === "number"
) {
const point = parsed as { x: number; y: number };
return {
x: Math.max(8, point.x),
y: Math.max(8, point.y),
};
}
}
} catch {
// Ignore malformed local storage data.
}
return { x: Math.max(8, window.innerWidth - 64), y: Math.max(8, window.innerHeight - 152) };
});
const [readerSettingsReady, setReaderSettingsReady] = useState(false);

const setTheme = useCallback(
	(next: AppTheme) => {
		setReaderTheme(next);
	},
	[setReaderTheme],
);

const pendingReaderSettingsRef = useRef<Partial<ReaderSettings>>({});
const settingsSaveTimerRef = useRef<number | null>(null);

const effectiveParagraphColor = useMemo(() => {
if (useCustomHighlight) return paragraphHighlightColor;
return getTheme(theme)["reader.highlight"];
}, [useCustomHighlight, paragraphHighlightColor, theme]);

const effectiveWordColor = useMemo(() => {
if (useCustomHighlight) return wordHighlightColor;
return getTheme(theme)["reader.wordHighlight"];
}, [useCustomHighlight, wordHighlightColor, theme]);

useEffect(() => {
return () => {
if (settingsSaveTimerRef.current !== null && typeof window !== "undefined") {
window.clearTimeout(settingsSaveTimerRef.current);
}
};
}, []);

const persistReaderSettings = useCallback(
(changes: Partial<ReaderSettings>, options?: { immediate?: boolean }) => {
if (!user) return;

pendingReaderSettingsRef.current = { ...pendingReaderSettingsRef.current, ...changes };

if (settingsSaveTimerRef.current !== null && typeof window !== "undefined") {
window.clearTimeout(settingsSaveTimerRef.current);
}

const saveAction = async () => {
const payload = pendingReaderSettingsRef.current;
pendingReaderSettingsRef.current = {};
settingsSaveTimerRef.current = null;
try {
await api.updateSettings({ reader: payload });
} catch (err) {
console.error("Failed to automatically persist reader configurations:", err);
}
};

if (options?.immediate) {
void saveAction();
} else if (typeof window !== "undefined") {
settingsSaveTimerRef.current = window.setTimeout(saveAction, 2000);
}
},
[user],
);

useEffect(() => {
async function initializeReaderSettings() {
if (!user) {
setReaderSettingsReady(true);
return;
}
try {
const settings = await api.getSettings();
const reader = settings.reader;
if (reader) {
if (reader.fontSize) setFontSize(reader.fontSize);
if (reader.width) setReadWidth(reader.width);
if (reader.autoNext !== undefined) setAutoOpenNext(reader.autoNext);
if (reader.speechRate) setRate(reader.speechRate);
if (reader.speechPitch) setPitch(reader.speechPitch);
if (reader.voiceURI) setSelectedVoiceURI(reader.voiceURI);
if (reader.playbackEngine) setPlaybackEngine(normalizePlaybackEngine(reader.playbackEngine as PlaybackEngineName, allowLocalTts));
if (reader.highlightMode) setHighlightMode(reader.highlightMode);
if (reader.highlightParagraph !== undefined) setHighlightParagraph(reader.highlightParagraph);
if (reader.useCustomHighlight !== undefined) setUseCustomHighlight(reader.useCustomHighlight);
if (reader.paragraphHighlightColor) setParagraphHighlightColor(reader.paragraphHighlightColor);
if (reader.wordHighlightColor) setWordHighlightColor(reader.wordHighlightColor);
if (reader.sentenceHighlightOpacity !== undefined) setSentenceHighlightOpacity(reader.sentenceHighlightOpacity);
if (reader.autoScrollDuringSpeech !== undefined) setAutoScrollDuringSpeech(reader.autoScrollDuringSpeech);
if (reader.autoScrollBehavior) setAutoScrollBehavior(reader.autoScrollBehavior);
if (reader.autoScrollOffset !== undefined) setAutoScrollOffset(reader.autoScrollOffset);
if (reader.speechPortalPosition) setSpeechPortalPosition(reader.speechPortalPosition);
}
} catch (err) {
console.error("Failed to fetch custom settings profile:", err);
} finally {
setReaderSettingsReady(true);
}
}
void initializeReaderSettings();
}, [user, allowLocalTts]);

const handleThemeChange = (newTheme: AppTheme) => {
setTheme(newTheme);
};

const handleFontSizeChange = (increment: boolean) => {
const nextSize = increment ? Math.min(32, fontSize + 1) : Math.max(12, fontSize - 1);
setFontSize(nextSize);
persistReaderSettings({ fontSize: nextSize });
};

const handleWidthChange = (newWidth: ReaderWidth) => {
setReadWidth(newWidth);
persistReaderSettings({ width: newWidth });
};

const handleAutoOpenNextChange = (enabled: boolean) => {
setAutoOpenNext(enabled);
persistReaderSettings({ autoNext: enabled });
};

const handleSpeechRateChange = (nextRate: number) => {
const clamped = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, nextRate));
setRate(clamped);
persistReaderSettings({ speechRate: clamped });
};

const handleSpeechPitchChange = (nextPitch: number) => {
const clamped = Math.min(SPEECH_PITCH_MAX, Math.max(SPEECH_PITCH_MIN, nextPitch));
setPitch(clamped);
persistReaderSettings({ speechPitch: clamped });
};

const handleVoiceChange = (voiceURI: string) => {
setSelectedVoiceURI(voiceURI);
persistReaderSettings({ voiceURI });
};

const handlePlaybackEngineChange = (engine: PlaybackEngineName) => {
const safeEngine = normalizePlaybackEngine(engine, allowLocalTts);
setPlaybackEngine(safeEngine);
persistReaderSettings({ playbackEngine: safeEngine });
};

const handleHighlightModeChange = (mode: ReaderHighlightMode) => {
setHighlightMode(mode);
persistReaderSettings({ highlightMode: mode });
};

const handleHighlightParagraphChange = (enabled: boolean) => {
setHighlightParagraph(enabled);
persistReaderSettings({ highlightParagraph: enabled });
};

const handleUseCustomHighlightChange = (enabled: boolean) => {
setUseCustomHighlight(enabled);
const updates: Partial<ReaderSettings> = { useCustomHighlight: enabled };

if (enabled) {
const themeTokens = getTheme(theme);
if (paragraphHighlightColor === DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR) {
const color = themeTokens["reader.highlight"];
setParagraphHighlightColor(color);
updates.paragraphHighlightColor = color;
}
if (wordHighlightColor === DEFAULT_WORD_HIGHLIGHT_COLOR) {
const color = themeTokens["reader.wordHighlight"];
setWordHighlightColor(color);
updates.wordHighlightColor = color;
}
}

persistReaderSettings(updates);
};

const handleParagraphHighlightColorChange = (nextColor: string) => {
const normalized = normalizeHexColor(nextColor, DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR);
setParagraphHighlightColor(normalized);
setUseCustomHighlight(true);
persistReaderSettings({ useCustomHighlight: true, paragraphHighlightColor: normalized });
};

const handleWordHighlightColorChange = (nextColor: string) => {
const normalized = normalizeHexColor(nextColor, DEFAULT_WORD_HIGHLIGHT_COLOR);
setWordHighlightColor(normalized);
setUseCustomHighlight(true);
persistReaderSettings({ useCustomHighlight: true, wordHighlightColor: normalized });
};

const handleSentenceHighlightOpacityChange = (value: number) => {
const nextValue = Math.min(0.6, Math.max(0.05, value));
setSentenceHighlightOpacity(nextValue);
persistReaderSettings({ sentenceHighlightOpacity: Number(nextValue.toFixed(2)) });
};

const handleAutoScrollDuringSpeechChange = (enabled: boolean) => {
setAutoScrollDuringSpeech(enabled);
persistReaderSettings({ autoScrollDuringSpeech: enabled });
};

const handleAutoScrollBehaviorChange = (behavior: ReaderAutoScrollBehavior) => {
setAutoScrollBehavior(behavior);
persistReaderSettings({ autoScrollBehavior: behavior });
};

const handleAutoScrollOffsetChange = (value: number) => {
const nextOffset = Math.round(Math.min(260, Math.max(48, value)));
setAutoScrollOffset(nextOffset);
persistReaderSettings({ autoScrollOffset: nextOffset });
};

const handleSpeechPortalPositionChange = useCallback(
(nextPosition: { x: number; y: number }, options?: { immediate?: boolean }) => {
setSpeechPortalPosition(nextPosition);
persistReaderSettings({ speechPortalPosition: nextPosition }, options);
},
[persistReaderSettings],
);

const handleSpeechTogglePositionChange = (nextPosition: { x: number; y: number }) => {
setSpeechTogglePosition(nextPosition);
if (typeof window === "undefined") return;
try {
window.localStorage.setItem("books_reader_speech_toggle_position", JSON.stringify(nextPosition));
} catch {
// Storage may be unavailable in restricted contexts.
}
};

return {
theme,
onThemeChange: handleThemeChange,
fontSize,
onFontSizeDecrease: () => handleFontSizeChange(false),
onFontSizeIncrease: () => handleFontSizeChange(true),
readWidth,
onReadWidthChange: handleWidthChange,
autoOpenNext,
onAutoOpenNextChange: handleAutoOpenNextChange,
highlightMode,
onHighlightModeChange: handleHighlightModeChange,
highlightParagraph,
onHighlightParagraphChange: handleHighlightParagraphChange,
useCustomHighlight,
onUseCustomHighlightChange: handleUseCustomHighlightChange,
paragraphColor: effectiveParagraphColor,
onParagraphColorChange: handleParagraphHighlightColorChange,
wordColor: effectiveWordColor,
onWordColorChange: handleWordHighlightColorChange,
sentenceHighlightOpacity,
onSentenceHighlightOpacityChange: handleSentenceHighlightOpacityChange,
autoScrollDuringSpeech,
onAutoScrollDuringSpeechChange: handleAutoScrollDuringSpeechChange,
autoScrollBehavior,
onAutoScrollBehaviorChange: handleAutoScrollBehaviorChange,
autoScrollOffset,
onAutoScrollOffsetChange: handleAutoScrollOffsetChange,
rate,
onRateChange: handleSpeechRateChange,
pitch,
onPitchChange: handleSpeechPitchChange,
voiceURI: selectedVoiceURI,
onVoiceChange: handleVoiceChange,
playbackEngine,
onPlaybackEngineChange: handlePlaybackEngineChange,
speechPortalPosition,
onPositionChange: handleSpeechPortalPositionChange,
speechTogglePosition,
onTogglePositionChange: handleSpeechTogglePositionChange,
readerSettingsReady,
};
}
