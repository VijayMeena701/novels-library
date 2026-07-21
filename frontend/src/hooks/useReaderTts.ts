"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ChapterContent, type ReaderAutoScrollBehavior, type ReaderHighlightMode, type PronunciationRule } from "../utils/api";
import { type SpeechConfig } from "./useReaderSettings";
import {
	TtsStatus,
	SPEECH_BLOCK_SELECTOR,
	TTS_SESSION_FLAG,
	type SpeechQueueItem,
	type SpeechBlock,
	getScrollParent,
	isSpeechLeafBlock,
	splitSpeechTextWithOffsets,
	applyPronunciationRules,
} from "../lib/reader-utils";

export interface UseReaderTtsReturn {
	ttsStatus: TtsStatus;
	speechError: string;
	play: () => void;
	pause: () => void;
	stop: (options?: { preserveContinuation?: boolean }) => void;
	startSpeechFromBlock: (startBlockIndex: number, options?: { continueAcrossChapters?: boolean; fromUserGesture?: boolean }) => boolean;
}

export function useReaderTts({
	readerContentRef,
	chapter,
	chapterNumber,
	hasNextChapter,
	nextChapterNumber,
	navigateToChapter,
	autoOpenNext,
	rate,
	pitch,
	voiceURI,
	speechConfigRef,
	pronunciationRules,
	availableVoices,
	highlightParagraph,
	paragraphHighlightColor,
	autoScrollDuringSpeech,
	autoScrollOffset,
	autoScrollBehavior,
	wordHighlightColor,
	highlightMode,
	shouldResumeTtsFromRoute,
	loading,
	readerSettingsReady,
	authLoading,
	speechSupported,
}: {
	readerContentRef: React.RefObject<HTMLDivElement | null>;
	chapter: ChapterContent | null;
	chapterNumber: number;
	hasNextChapter: boolean;
	nextChapterNumber: number;
	navigateToChapter: (nextChapterNumber: number, options?: { resumeTts?: boolean }) => void;
	autoOpenNext: boolean;
	rate: number;
	pitch: number;
	voiceURI: string;
	speechConfigRef: React.MutableRefObject<SpeechConfig>;
	pronunciationRules: PronunciationRule[];
	availableVoices: SpeechSynthesisVoice[];
	highlightParagraph: boolean;
	paragraphHighlightColor: string;
	autoScrollDuringSpeech: boolean;
	autoScrollOffset: number;
	autoScrollBehavior: ReaderAutoScrollBehavior;
	wordHighlightColor: string;
	highlightMode: ReaderHighlightMode;
	shouldResumeTtsFromRoute: boolean;
	loading: boolean;
	readerSettingsReady: boolean;
	authLoading: boolean;
	speechSupported: boolean;
}): UseReaderTtsReturn {
	const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const speechStartTimerRef = useRef<number | null>(null);
	const speechQueueRef = useRef<SpeechQueueItem[]>([]);
	const speechIndexRef = useRef(0);
	const speakQueuedChunkRef = useRef<(index: number) => void>(() => {});
	const ttsStatusRef = useRef<TtsStatus>("idle");
	const speechBlocksRef = useRef<SpeechBlock[]>([]);
	const activeSpeechBlockIndexRef = useRef<number | null>(null);
	const activeQueueItemRef = useRef<SpeechQueueItem | null>(null);
	const activeSpeechElementRef = useRef<HTMLElement | null>(null);
	const activeWordHighlightRef = useRef<HTMLElement | null>(null);
	const hasUserInteractedRef = useRef(false);
	const pronunciationRulesRef = useRef<PronunciationRule[]>(pronunciationRules);
	const speechRestartTimerRef = useRef<number | null>(null);
	const shouldContinueSpeechRef = useRef(autoOpenNext);
	const startedAutoSpeechForChapterRef = useRef<number | null>(null);

	const [ttsStatus, setTtsStatus] = useState<TtsStatus>("idle");
	const [speechError, setSpeechError] = useState("");

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (window.sessionStorage.getItem(TTS_SESSION_FLAG) === "1" && !hasUserInteractedRef.current) {
			hasUserInteractedRef.current = true;
		}
	}, []);

	useEffect(() => {
		shouldContinueSpeechRef.current = autoOpenNext;
	}, [autoOpenNext]);

	const buildSpeechBlocks = useCallback((): SpeechBlock[] => {
		const root = readerContentRef.current;
		if (!root) return [];

		const found: SpeechBlock[] = [];
		const nodes = root.querySelectorAll(SPEECH_BLOCK_SELECTOR);

		nodes.forEach((node) => {
			if (node instanceof HTMLElement && isSpeechLeafBlock(node)) {
				const text = node.textContent?.trim() || "";
				if (text) {
					found.push({ element: node, text });
				}
			}
		});

		return found;
	}, [readerContentRef]);

	const getSpeechBlocks = useCallback((): SpeechBlock[] => {
		const root = readerContentRef.current;
		if (!root) return [];

		const isConnected = (element: HTMLElement) => element.isConnected && root.contains(element);
		if (speechBlocksRef.current.length > 0 && speechBlocksRef.current.every((block) => isConnected(block.element))) {
			return speechBlocksRef.current;
		}

		speechBlocksRef.current = buildSpeechBlocks();
		return speechBlocksRef.current;
	}, [buildSpeechBlocks, readerContentRef]);

	const clearSpeakingWord = useCallback(() => {
		if (activeWordHighlightRef.current) {
			const span = activeWordHighlightRef.current;
			const parent = span.parentNode;
			if (parent) {
				const textNode = document.createTextNode(span.textContent || "");
				parent.replaceChild(textNode, span);
				parent.normalize();
			}
			activeWordHighlightRef.current = null;
		}
	}, []);

	const clearSpeakingHighlights = useCallback(() => {
		clearSpeakingWord();
		if (activeSpeechElementRef.current) {
			const element = activeSpeechElementRef.current;
			element.style.backgroundColor = "";
			element.style.boxShadow = "";
			element.style.borderRadius = "";
			element.style.transition = "";
			activeSpeechElementRef.current = null;
		}
	}, [clearSpeakingWord]);

	const highlightSpeechBlock = useCallback(
		(blockIndex: number) => {
			clearSpeakingHighlights();

			const blocks = getSpeechBlocks();
			const block = blocks[blockIndex];
			if (!block) return;

			if (highlightParagraph) {
				const element = block.element;
				element.style.backgroundColor = paragraphHighlightColor;
				element.style.boxShadow = `0 0 0 4px ${paragraphHighlightColor}`;
				element.style.borderRadius = "4px";
				element.style.transition = "background-color 0.15s ease, box-shadow 0.15s ease";
			}
			activeSpeechElementRef.current = block.element;

			if (autoScrollDuringSpeech && typeof window !== "undefined") {
				const parent = getScrollParent(block.element);
				if (parent === window) {
					const rect = block.element.getBoundingClientRect();
					const targetScrollY = window.scrollY + rect.top - autoScrollOffset;
					window.scrollTo({
						top: targetScrollY,
						behavior: autoScrollBehavior,
					});
				} else if (parent instanceof HTMLElement) {
					const rect = block.element.getBoundingClientRect();
					const parentRect = parent.getBoundingClientRect();
					const targetScrollTop = parent.scrollTop + rect.top - parentRect.top - autoScrollOffset;
					parent.scrollTo({
						top: targetScrollTop,
						behavior: autoScrollBehavior,
					});
				}
			}
		},
		[getSpeechBlocks, clearSpeakingHighlights, autoScrollDuringSpeech, autoScrollOffset, autoScrollBehavior, highlightParagraph, paragraphHighlightColor],
	);

	const highlightSpeechWord = useCallback(
		(blockIndex: number, charIndexInBlock: number) => {
			clearSpeakingWord();

			const blocks = getSpeechBlocks();
			const block = blocks[blockIndex];
			if (!block || !block.element) return;

			const blockText = block.text;
			if (charIndexInBlock < 0 || charIndexInBlock >= blockText.length) return;

			let start = charIndexInBlock;
			while (start > 0 && /\w/.test(blockText[start - 1])) {
				start--;
			}
			let end = charIndexInBlock;
			while (end < blockText.length && /\w/.test(blockText[end])) {
				end++;
			}

			if (start === end) return;

			const before = blockText.slice(0, start);
			const word = blockText.slice(start, end);
			const after = blockText.slice(end);

			const element = block.element;
			element.innerHTML = "";

			if (before) {
				element.appendChild(document.createTextNode(before));
			}

			const span = document.createElement("span");
			span.style.backgroundColor = wordHighlightColor;
			span.style.color = "#000";
			span.style.borderRadius = "2px";
			span.textContent = word;
			element.appendChild(span);
			activeWordHighlightRef.current = span;

			if (after) {
				element.appendChild(document.createTextNode(after));
			}
		},
		[getSpeechBlocks, clearSpeakingWord, wordHighlightColor],
	);

	const createSpeechQueueFromBlock = useCallback(
		(startBlockIndex: number): SpeechQueueItem[] => {
			const blocks = getSpeechBlocks();
			const queue: SpeechQueueItem[] = [];

			for (let i = startBlockIndex; i < blocks.length; i++) {
				const block = blocks[i];
				const chunks = splitSpeechTextWithOffsets(block.text);

				for (const chunk of chunks) {
					const spokenText = applyPronunciationRules(chunk.text, pronunciationRulesRef.current);
					queue.push({
						text: chunk.text,
						spokenText,
						blockIndex: i,
						startOffset: chunk.startOffset,
					});
				}
			}

			return queue;
		},
		[getSpeechBlocks],
	);

	const stopSpeech = useCallback(
		(options?: { preserveContinuation?: boolean }) => {
			if (speechStartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechStartTimerRef.current);
				speechStartTimerRef.current = null;
			}
			if (speechRestartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechRestartTimerRef.current);
				speechRestartTimerRef.current = null;
			}
			if (!options?.preserveContinuation) {
				shouldContinueSpeechRef.current = false;
			}
			clearSpeakingHighlights();
			activeSpeechBlockIndexRef.current = null;
			activeQueueItemRef.current = null;
			ttsStatusRef.current = "idle";
			setTtsStatus("idle");

			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				// CRITICAL PREVENT autoplay block: Keep the speech engine talking (not cancelled)
				// when unmounting and transitioning to the next chapter so session remains active.
				if (!options?.preserveContinuation) {
					activeUtteranceRef.current = null;
					window.speechSynthesis.cancel();
				}
			}
		},
		[clearSpeakingHighlights],
	);

	const speakQueuedChunk = useCallback(
		(index: number) => {
			if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

			const speechItem = speechQueueRef.current[index];
			if (!speechItem) {
				activeUtteranceRef.current = null;
				speechIndexRef.current = 0;
				speechQueueRef.current = [];
				activeSpeechBlockIndexRef.current = null;
				activeQueueItemRef.current = null;
				clearSpeakingHighlights();

				if (shouldContinueSpeechRef.current && hasNextChapter) {
					// CRITICAL keep-alive queue continuation:
					// Before letting the speech queue completely clear and navigating (which marks speech session as idle),
					// play a transient, natural keep-alive voice indicator. This keeps the global SpeechSynthesis engine
					// actively talking, meaning when the next page mounts programmatically, the engine can be hijacked
					// and updated without losing the user gesture authorization boundary or triggering "not-allowed".
					const transitionalPrompt = new SpeechSynthesisUtterance("Loading next chapter.");
					transitionalPrompt.rate = speechConfigRef.current.rate;
					transitionalPrompt.pitch = speechConfigRef.current.pitch;
					const selectedVoice = availableVoices.find((voice) => voice.voiceURI === speechConfigRef.current.voiceURI);
					if (selectedVoice) {
						transitionalPrompt.voice = selectedVoice;
					}
					window.speechSynthesis.speak(transitionalPrompt);

					navigateToChapter(nextChapterNumber, { resumeTts: true });
				} else {
					speechQueueRef.current = [];
					speechIndexRef.current = 0;
					activeSpeechBlockIndexRef.current = null;
					activeQueueItemRef.current = null;
					clearSpeakingHighlights();
					ttsStatusRef.current = "idle";
					setTtsStatus("idle");
					shouldContinueSpeechRef.current = false;
				}
				return;
			}

			if (!speechItem.spokenText) {
				speechIndexRef.current = index + 1;
				speakQueuedChunkRef.current(index + 1);
				return;
			}

			activeQueueItemRef.current = speechItem;

			if (activeSpeechBlockIndexRef.current !== speechItem.blockIndex) {
				highlightSpeechBlock(speechItem.blockIndex);
			}
			activeSpeechBlockIndexRef.current = speechItem.blockIndex;

			const utterance = new SpeechSynthesisUtterance(speechItem.spokenText);
			utterance.rate = speechConfigRef.current.rate;
			utterance.pitch = speechConfigRef.current.pitch;
			const selectedVoice = availableVoices.find((voice) => voice.voiceURI === speechConfigRef.current.voiceURI);
			if (selectedVoice) {
				utterance.voice = selectedVoice;
			}
			utterance.onstart = () => {
				if (activeUtteranceRef.current !== utterance) return;
				if (activeSpeechBlockIndexRef.current !== speechItem.blockIndex) {
					highlightSpeechBlock(speechItem.blockIndex);
				}
				activeSpeechBlockIndexRef.current = speechItem.blockIndex;
			};
			utterance.onend = () => {
				if (activeUtteranceRef.current !== utterance) return;
				if (highlightMode === "word") {
					clearSpeakingWord();
				}
				speechIndexRef.current = index + 1;
				speakQueuedChunkRef.current(index + 1);
			};
			utterance.onboundary = (event) => {
				if (activeUtteranceRef.current !== utterance) return;
				if (highlightMode !== "word") return;
				if (event.name && event.name !== "word") return;

				const queueItem = activeQueueItemRef.current;
				if (!queueItem || queueItem.spokenText !== queueItem.text) return;
				const absoluteCharIndex = queueItem.startOffset + (event.charIndex || 0);
				highlightSpeechWord(queueItem.blockIndex, absoluteCharIndex);
			};
			utterance.onerror = (event) => {
				if (activeUtteranceRef.current !== utterance) return;
				console.error("Speech synthesis error:", event.error);
				if (event.error === "not-allowed") {
					setSpeechError("Browser blocked autoplay. Press Play after tapping or clicking anywhere on the page.");
				} else {
					setSpeechError("Text to speech stopped in the browser.");
				}
				activeUtteranceRef.current = null;
				activeQueueItemRef.current = null;
				clearSpeakingHighlights();
				ttsStatusRef.current = "idle";
				setTtsStatus("idle");
			};

			activeUtteranceRef.current = utterance;
			ttsStatusRef.current = "playing";
			setTtsStatus("playing");
			window.speechSynthesis.speak(utterance);
		},
		[
			availableVoices,
			clearSpeakingHighlights,
			clearSpeakingWord,
			hasNextChapter,
			highlightMode,
			highlightSpeechBlock,
			highlightSpeechWord,
			navigateToChapter,
			nextChapterNumber,
			speechConfigRef,
		],
	);

	useEffect(() => {
		speakQueuedChunkRef.current = speakQueuedChunk;
	}, [speakQueuedChunk]);

	const startSpeechFromBlock = useCallback(
		(startBlockIndex: number, options?: { continueAcrossChapters?: boolean; fromUserGesture?: boolean }): boolean => {
			if (!speechSupported || typeof window === "undefined" || !("speechSynthesis" in window)) {
				setSpeechError("Text to speech is not available in this browser.");
				return false;
			}

			if (options?.fromUserGesture) {
				hasUserInteractedRef.current = true;
				window.sessionStorage.setItem(TTS_SESSION_FLAG, "1");
			}

			if (!hasUserInteractedRef.current && !options?.fromUserGesture) {
				setSpeechError("Press Play once after interacting with this page to enable browser speech playback.");
				return false;
			}

			const queue = createSpeechQueueFromBlock(startBlockIndex);
			if (queue.length === 0) {
				setSpeechError("There is no readable text to play.");
				return false;
			}

			shouldContinueSpeechRef.current = Boolean(options?.continueAcrossChapters);
			activeUtteranceRef.current = null;
			window.speechSynthesis.cancel();
			speechQueueRef.current = queue;
			speechIndexRef.current = 0;
			activeSpeechBlockIndexRef.current = null;
			activeQueueItemRef.current = null;
			setSpeechError("");

			if (speechStartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechStartTimerRef.current);
				speechStartTimerRef.current = null;
			}

			speakQueuedChunkRef.current(0);
			return true;
		},
		[createSpeechQueueFromBlock, speechSupported],
	);

	const restartSpeechFromCurrentBlock = useCallback(() => {
		if (!speechSupported || typeof window === "undefined" || !("speechSynthesis" in window)) return;
		if (ttsStatusRef.current !== "playing") return;

		const startBlockIndex = activeSpeechBlockIndexRef.current ?? 0;
		const continueAcrossChapters = shouldContinueSpeechRef.current;

		if (speechRestartTimerRef.current !== null) {
			window.clearTimeout(speechRestartTimerRef.current);
		}

		speechRestartTimerRef.current = window.setTimeout(() => {
			speechRestartTimerRef.current = null;
			if (ttsStatusRef.current !== "playing") return;
			void startSpeechFromBlock(startBlockIndex, { continueAcrossChapters });
		}, 180);
	}, [speechSupported, startSpeechFromBlock]);

	useEffect(() => {
		pronunciationRulesRef.current = pronunciationRules;
		if (ttsStatusRef.current === "playing") {
			restartSpeechFromCurrentBlock();
		}
	}, [pronunciationRules, restartSpeechFromCurrentBlock]);

	useEffect(() => {
		if (ttsStatusRef.current === "playing") {
			restartSpeechFromCurrentBlock();
		}
	}, [rate, pitch, voiceURI, paragraphHighlightColor, wordHighlightColor, restartSpeechFromCurrentBlock]);

	const handlePlaySpeech = useCallback(() => {
		if (!speechSupported || typeof window === "undefined" || !("speechSynthesis" in window)) {
			setSpeechError("Text to speech is not available in this browser.");
			return;
		}

		if (ttsStatus === "paused") {
			shouldContinueSpeechRef.current = autoOpenNext;
			window.speechSynthesis.resume();
			ttsStatusRef.current = "playing";
			setTtsStatus("playing");
			return;
		}

		void startSpeechFromBlock(0, { continueAcrossChapters: autoOpenNext, fromUserGesture: true });
	}, [autoOpenNext, speechSupported, startSpeechFromBlock, ttsStatus]);

	const handlePauseSpeech = useCallback(() => {
		if (typeof window !== "undefined" && "speechSynthesis" in window && ttsStatus === "playing") {
			window.speechSynthesis.pause();
			ttsStatusRef.current = "paused";
			setTtsStatus("paused");
		}
	}, [ttsStatus]);

	useEffect(() => {
		const shouldAutoStartSpeech = shouldResumeTtsFromRoute || shouldContinueSpeechRef.current;

		if (
			authLoading ||
			loading ||
			!readerSettingsReady ||
			!speechSupported ||
			!chapter ||
			!shouldAutoStartSpeech ||
			startedAutoSpeechForChapterRef.current === chapterNumber
		) {
			return;
		}

		if (!hasUserInteractedRef.current) {
			setSpeechError("Browser requires one tap/click before auto-read can continue. Press Play to start.");
			return;
		}

		shouldContinueSpeechRef.current = true;
		const timer = window.setTimeout(() => {
			// Force rebuilding fresh blocks synchronously before initializing speech tracking
			speechBlocksRef.current = buildSpeechBlocks();
			const didStart = startSpeechFromBlock(0, { continueAcrossChapters: true });
			if (didStart) {
				startedAutoSpeechForChapterRef.current = chapterNumber;
			}
		}, 250); // Small margin to let dangerouslySetInnerHTML finish committing and parsing in the document layout

		return () => window.clearTimeout(timer);
	}, [
		authLoading,
		chapter,
		chapterNumber,
		loading,
		readerSettingsReady,
		shouldResumeTtsFromRoute,
		speechSupported,
		startSpeechFromBlock,
		buildSpeechBlocks,
	]);

	useEffect(() => {
		clearSpeakingHighlights();
		speechBlocksRef.current = [];
		activeSpeechBlockIndexRef.current = null;
		activeSpeechElementRef.current = null;
		activeWordHighlightRef.current = null;
	}, [chapter?.content, chapterNumber, clearSpeakingHighlights]);

	// Gracefully shutdown SpeechSynthesis and state timers on teardown
	useEffect(() => {
		return () => {
			if (speechStartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechStartTimerRef.current);
			}
			if (speechRestartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechRestartTimerRef.current);
			}
			stopSpeech();
		};
	}, [stopSpeech]);

	return {
		ttsStatus,
		speechError,
		play: handlePlaySpeech,
		pause: handlePauseSpeech,
		stop: stopSpeech,
		startSpeechFromBlock,
	};
}
