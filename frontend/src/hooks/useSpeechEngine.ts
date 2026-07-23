"use client";

import { useCallback, useMemo, useRef } from "react";
import type { SpeechConfig } from "@/lib/tts/speechTypes";

export interface SpeechEngineCallbacks {
	onStart?: () => void;
	onEnd?: () => void;
	onBoundary?: (event: SpeechSynthesisEvent) => void;
	onError?: (event: SpeechSynthesisErrorEvent) => void;
}

export interface UseSpeechEngineOptions {
	speechConfigRef: React.MutableRefObject<SpeechConfig>;
	availableVoices: SpeechSynthesisVoice[];
}

export interface UseSpeechEngineReturn {
	activeUtteranceRef: React.MutableRefObject<SpeechSynthesisUtterance | null>;
	speak: (text: string, callbacks?: SpeechEngineCallbacks) => void;
	speakKeepAlive: (text: string) => void;
	cancel: () => void;
	pause: () => void;
	resume: () => void;
}

export function useSpeechEngine({ speechConfigRef, availableVoices }: UseSpeechEngineOptions): UseSpeechEngineReturn {
	const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

	const cancel = useCallback(() => {
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}
		activeUtteranceRef.current = null;
	}, []);

	const pause = useCallback(() => {
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.pause();
		}
	}, []);

	const resume = useCallback(() => {
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.resume();
		}
	}, []);

	const applyConfigToUtterance = useCallback(
		(utterance: SpeechSynthesisUtterance) => {
			const config = speechConfigRef.current;
			utterance.rate = config.rate;
			utterance.pitch = config.pitch;
			const selectedVoice = availableVoices.find((voice) => voice.voiceURI === config.voiceURI);
			if (selectedVoice) {
				utterance.voice = selectedVoice;
			}
		},
		[availableVoices, speechConfigRef],
	);

	const speak = useCallback(
		(text: string, callbacks?: SpeechEngineCallbacks) => {
			if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

			const utterance = new SpeechSynthesisUtterance(text);
			applyConfigToUtterance(utterance);
			utterance.onstart = () => {
				if (activeUtteranceRef.current !== utterance) return;
				callbacks?.onStart?.();
			};
			utterance.onend = () => {
				if (activeUtteranceRef.current !== utterance) return;
				callbacks?.onEnd?.();
			};
			utterance.onboundary = (event) => {
				if (activeUtteranceRef.current !== utterance) return;
				callbacks?.onBoundary?.(event);
			};
			utterance.onerror = (event) => {
				if (activeUtteranceRef.current !== utterance) return;
				activeUtteranceRef.current = null;
				callbacks?.onError?.(event);
			};

			activeUtteranceRef.current = utterance;
			window.speechSynthesis.speak(utterance);
		},
		[applyConfigToUtterance],
	);

	const speakKeepAlive = useCallback(
		(text: string) => {
			if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

			const utterance = new SpeechSynthesisUtterance(text);
			applyConfigToUtterance(utterance);
			activeUtteranceRef.current = null;
			window.speechSynthesis.speak(utterance);
		},
		[applyConfigToUtterance],
	);

	const value = useMemo(
		() => ({
			activeUtteranceRef,
			speak,
			speakKeepAlive,
			cancel,
			pause,
			resume,
		}),
		[speak, speakKeepAlive, cancel, pause, resume],
	);
	return value;
}
