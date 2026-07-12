"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	api,
	type Book,
	type BookContent,
	type JobType,
	type PronunciationRule,
	type ReaderSettings,
	type ReaderAutoScrollBehavior,
	type ReaderHighlightMode,
	type ReaderTheme,
	type ReaderWidth,
	type SourceKind,
} from "../../../../../utils/api";
import { useAuth } from "../../../../../context/AuthContext";
import { CAPABILITY } from "../../../../../utils/permissions";
import { SpeechWidget } from "../../../../../components/reader/SpeechWidget";
import { ReaderBottomToolbar } from "../../../../../components/reader/ReaderBottomToolbar";
import { PronunciationRulesModal } from "../../../../../components/reader/PronunciationRulesModal";

type TtsStatus = "idle" | "playing" | "paused";
type ReaderPanelTab = "read" | "display" | "speech" | "settings" | "more";
type ReaderSource = "translated" | "raw";

const SPEECH_RATE_MIN = 0.5;
const SPEECH_RATE_MAX = 4;
const SPEECH_PITCH_MIN = 0.5;
const SPEECH_PITCH_MAX = 2;
const SPEECH_BLOCK_SELECTOR = "p, li, blockquote, h1, h2, h3, h4, div";
const HIGHLIGHT_MODES: ReaderHighlightMode[] = ["off", "paragraph", "word"];
const AUTOSCROLL_BEHAVIORS: ReaderAutoScrollBehavior[] = ["smooth", "instant"];
const DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR = "#f5d67a";
const DEFAULT_WORD_HIGHLIGHT_COLOR = "#f59e0b";
const TTS_SESSION_FLAG = "books_reader_user_started_tts";

interface SpeechChunk {
	text: string;
	startOffset: number;
}

interface CatalogUnit {
	unitNumber: number;
	title: string;
	archived: boolean;
	sourceUrl?: string;
	scrapedAt?: string;
}

interface SpeechQueueItem {
	text: string;
	spokenText: string;
	blockIndex: number;
	startOffset: number;
}

interface SpeechBlock {
	element: HTMLElement;
	text: string;
}

function getScrollParent(node: HTMLElement | null): HTMLElement | Window {
	if (!node) {
		return window;
	}
	let parent = node.parentElement;
	while (parent) {
		if (parent.tagName === "BODY" || parent.tagName === "HTML") {
			return window;
		}
		const style = window.getComputedStyle(parent);
		if (/(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX)) {
			return parent;
		}
		parent = parent.parentElement;
	}
	return window;
}

function isSpeechLeafBlock(element: HTMLElement): boolean {
	if (element.tagName !== "DIV") return true;

	// Ignore wrapper containers so playback follows real content blocks.
	return !Array.from(element.children).some((child) => {
		if (!(child instanceof HTMLElement)) return false;
		return ["P", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "DIV"].includes(child.tagName);
	});
}

function normalizeTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isGenericUnitTitle(value: string, bookTitle: string, unitNumber: number): boolean {
	const normalized = normalizeTitle(value);
	return !normalized || normalized === normalizeTitle(bookTitle) || normalized === `unit ${unitNumber}` || normalized === `ch ${unitNumber}`;
}

function resolveUnitTitle(bookTitle: string, unitNumber: number, archivedTitle?: string, indexedTitle?: string): string {
	const archived = archivedTitle?.trim() || "";
	const indexed = indexedTitle?.trim() || "";

	if (indexed && isGenericUnitTitle(archived, bookTitle, unitNumber)) {
		return indexed;
	}

	return archived || indexed || `Unit ${unitNumber}`;
}

function splitSpeechTextWithOffsets(text: string, maxLength = 1800): SpeechChunk[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return [];

	const chunks: SpeechChunk[] = [];
	let remaining = normalized;
	let consumed = 0;

	while (remaining.length > maxLength) {
		const punctuationBreak = Math.max(
			remaining.lastIndexOf(".", maxLength),
			remaining.lastIndexOf("!", maxLength),
			remaining.lastIndexOf("?", maxLength),
			remaining.lastIndexOf(";", maxLength),
			remaining.lastIndexOf(",", maxLength),
		);
		const wordBreak = remaining.lastIndexOf(" ", maxLength);
		const breakAt = punctuationBreak > maxLength * 0.45 ? punctuationBreak + 1 : wordBreak > maxLength * 0.45 ? wordBreak : maxLength;
		const chunk = remaining.slice(0, breakAt).trim();
		if (chunk) {
			const exactStart = normalized.indexOf(chunk, consumed);
			chunks.push({
				text: chunk,
				startOffset: exactStart !== -1 ? exactStart : consumed,
			});
		}
		consumed += breakAt;
		remaining = remaining.slice(breakAt).trim();
	}

	if (remaining) {
		const exactStart = normalized.indexOf(remaining, consumed);
		chunks.push({
			text: remaining,
			startOffset: exactStart !== -1 ? exactStart : consumed,
		});
	}

	return chunks;
}

function normalizeHexColor(value: string, fallback: string): string {
	const normalized = value.trim().toLowerCase();
	return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLetter(char: string): boolean {
	return /^\p{Letter}$/u.test(char);
}

function buildWholeWordPattern(pattern: string): string {
	const escaped = escapeRegExp(pattern);
	const chars = Array.from(pattern);
	const firstChar = chars[0];
	const lastChar = chars[chars.length - 1];
	const prefix = firstChar && isLetter(firstChar) ? "(?<!\\p{Letter})" : "";
	const suffix = lastChar && isLetter(lastChar) ? "(?!\\p{Letter})" : "";
	return `${prefix}${escaped}${suffix}`;
}

/**
 * Rewrites text to speak using the user's pronunciation rules for this book (or their
 * "all books" global rules). Rules with an empty replacement mute/skip the matched text.
 */
function applyPronunciationRules(text: string, rules: PronunciationRule[]): string {
	if (!rules.length) return text;

	let result = text;
	for (const rule of rules) {
		if (!rule.enabled || !rule.pattern) continue;

		const pattern = rule.wholeWord ? buildWholeWordPattern(rule.pattern) : escapeRegExp(rule.pattern);
		const flags = rule.caseSensitive ? "gu" : "giu";
		try {
			const regex = new RegExp(pattern, flags);
			result = result.replace(regex, rule.replacement);
		} catch {
			// Ignore malformed patterns rather than breaking speech playback.
		}
	}

	return result.replace(/\s+/g, " ").trim();
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (typeof error === "object" && error && "message" in error) {
		const maybeMessage = (error as { message?: unknown }).message;
		if (typeof maybeMessage === "string" && maybeMessage.trim()) {
			return maybeMessage;
		}
	}

	return fallback;
}

export default function ReaderView({ params }: { params: Promise<{ id: string; unitNumber: string }> | { id: string; unitNumber: string } }) {
	const resolvedParams = params instanceof Promise ? use(params) : params;
	const { id: bookId, unitNumber: chNumStr } = resolvedParams;

	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading: authLoading, hasCapability } = useAuth();

	const unitNumber = parseInt(chNumStr, 10);
	const shouldResumeTtsFromRoute = searchParams.get("tts") === "1";
	const readingSource: ReaderSource = searchParams.get("source") === "raw" ? "raw" : "translated";
	const isRawReader = readingSource === "raw";

	const [book, setBook] = useState<Book | null>(null);
	const [unit, setUnit] = useState<BookContent | null>(null);
	const [units, setUnits] = useState<Omit<BookContent, "content">[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [translatingRawUnit, setTranslatingRawUnit] = useState(false);
	const [adminActionMessage, setAdminActionMessage] = useState("");
	const [adminScrapingUnit, setAdminScrapingUnit] = useState(false);
	const [unitHtmlPageUrl, setUnitHtmlPageUrl] = useState("");
	const [unitHtmlContent, setUnitHtmlContent] = useState("");
	const [importingUnitHtml, setImportingUnitHtml] = useState(false);

	const [theme, setTheme] = useState<ReaderTheme>("sepia");
	const [fontSize, setFontSize] = useState<number>(18);
	const [readWidth, setReadWidth] = useState<ReaderWidth>("narrow");
	const [autoOpenNext, setAutoOpenNext] = useState(false);
	const [isCatalogOpen, setIsCatalogOpen] = useState(false);
	const [isReaderPanelOpen, setIsReaderPanelOpen] = useState(false);
	const [readerSettingsReady, setReaderSettingsReady] = useState(true);
	const [readerPanelTab, setReaderPanelTab] = useState<ReaderPanelTab>("read");
	const [catalogSearch, setCatalogSearch] = useState("");

	const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
	const [ttsStatus, setTtsStatus] = useState<TtsStatus>("idle");
	const [speechRate, setSpeechRate] = useState(1);
	const [speechPitch, setSpeechPitch] = useState(1);
	const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
	const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
	const [speechError, setSpeechError] = useState("");
	const [highlightMode, setHighlightMode] = useState<ReaderHighlightMode>("paragraph");
	const [highlightParagraph, setHighlightParagraph] = useState(true);
	const [paragraphHighlightColor, setParagraphHighlightColor] = useState(DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR);
	const [wordHighlightColor, setWordHighlightColor] = useState(DEFAULT_WORD_HIGHLIGHT_COLOR);
	const [sentenceHighlightOpacity, setSentenceHighlightOpacity] = useState(0.2);
	const [autoScrollDuringSpeech, setAutoScrollDuringSpeech] = useState(true);
	const [autoScrollBehavior, setAutoScrollBehavior] = useState<ReaderAutoScrollBehavior>("smooth");
	const [autoScrollOffset, setAutoScrollOffset] = useState(120);
	const [speechPortalPosition, setSpeechPortalPosition] = useState({ x: 24, y: 120 });

	const [pronunciationRules, setPronunciationRules] = useState<PronunciationRule[]>([]);
	const [pronunciationRulesLoading, setPronunciationRulesLoading] = useState(false);
	const [pronunciationRulesError, setPronunciationRulesError] = useState("");
	const [isPronunciationModalOpen, setIsPronunciationModalOpen] = useState(false);

	const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const speechStartTimerRef = useRef<number | null>(null);
	const speechQueueRef = useRef<SpeechQueueItem[]>([]);
	const speechBlocksRef = useRef<SpeechBlock[]>([]);
	const activeSpeechElementRef = useRef<HTMLElement | null>(null);
	const activeWordHighlightRef = useRef<HTMLElement | null>(null);
	const speechIndexRef = useRef(0);
	const activeSpeechBlockIndexRef = useRef<number | null>(null);
	const activeQueueItemRef = useRef<SpeechQueueItem | null>(null);
	const hasUserInteractedRef = useRef(false);
	const speakQueuedChunkRef = useRef<(index: number) => void>(() => undefined);
	const ttsStatusRef = useRef<TtsStatus>("idle");
	const speechConfigRef = useRef({
		rate: 1,
		pitch: 1,
		voiceURI: "",
	});
	const pronunciationRulesRef = useRef<PronunciationRule[]>([]);
	const speechRestartTimerRef = useRef<number | null>(null);
	const shouldContinueSpeechRef = useRef(false);
	const startedAutoSpeechForUnitRef = useRef<number | null>(null);
	const readerContentRef = useRef<HTMLDivElement | null>(null);
	const pendingReaderSettingsRef = useRef<Partial<ReaderSettings>>({});
	const settingsSaveTimerRef = useRef<number | null>(null);

	const flushReaderSettings = useCallback(() => {
		if (!user) return;

		const patch = pendingReaderSettingsRef.current;
		if (Object.keys(patch).length === 0) return;

		pendingReaderSettingsRef.current = {};
		if (settingsSaveTimerRef.current !== null && typeof window !== "undefined") {
			window.clearTimeout(settingsSaveTimerRef.current);
			settingsSaveTimerRef.current = null;
		}

		void api.updateSettings({ reader: patch }).catch((err) => {
			console.error("Failed to save reader settings:", err);
		});
	}, [user]);

	const persistReaderSettings = useCallback(
		(patch: Partial<ReaderSettings>, options?: { immediate?: boolean }) => {
			if (!user || typeof window === "undefined") return;

			pendingReaderSettingsRef.current = {
				...pendingReaderSettingsRef.current,
				...patch,
				speechPortalPosition: patch.speechPortalPosition
					? {
							...pendingReaderSettingsRef.current.speechPortalPosition,
							...patch.speechPortalPosition,
						}
					: pendingReaderSettingsRef.current.speechPortalPosition,
			};

			if (settingsSaveTimerRef.current !== null) {
				window.clearTimeout(settingsSaveTimerRef.current);
				settingsSaveTimerRef.current = null;
			}

			if (options?.immediate) {
				flushReaderSettings();
				return;
			}

			settingsSaveTimerRef.current = window.setTimeout(() => {
				flushReaderSettings();
			}, 350);
		},
		[flushReaderSettings, user],
	);

	useEffect(() => {
		return () => {
			flushReaderSettings();
			if (settingsSaveTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(settingsSaveTimerRef.current);
			}
		};
	}, [flushReaderSettings]);

	useEffect(() => {
		if (authLoading) return;

		if (!user) return;

		let cancelled = false;

		async function loadSettings() {
			setReaderSettingsReady(false);
			try {
				const settings = await api.getSettings();
				if (cancelled) return;
				const loadedPortalPosition = {
					x: Math.max(8, settings.reader.speechPortalPosition?.x ?? 24),
					y: Math.max(8, settings.reader.speechPortalPosition?.y ?? 120),
				};
				const nextSpeechRate = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, settings.reader.speechRate));
				const nextSpeechPitch = Math.min(SPEECH_PITCH_MAX, Math.max(SPEECH_PITCH_MIN, settings.reader.speechPitch));
				const nextHighlightMode = HIGHLIGHT_MODES.includes(settings.reader.highlightMode) ? settings.reader.highlightMode : "paragraph";
				const nextParagraphHighlightColor = normalizeHexColor(settings.reader.paragraphHighlightColor || "", DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR);
				const nextWordHighlightColor = normalizeHexColor(settings.reader.wordHighlightColor || "", DEFAULT_WORD_HIGHLIGHT_COLOR);
				const nextSentenceHighlightOpacity = Math.min(0.6, Math.max(0.05, settings.reader.sentenceHighlightOpacity ?? 0.2));
				const nextAutoScrollBehavior = AUTOSCROLL_BEHAVIORS.includes(settings.reader.autoScrollBehavior)
					? settings.reader.autoScrollBehavior
					: "smooth";
				const nextAutoScrollOffset = Math.round(Math.min(260, Math.max(48, settings.reader.autoScrollOffset ?? 120)));

				setTheme(settings.reader.theme);
				setFontSize(Math.min(32, Math.max(12, settings.reader.fontSize)));
				setReadWidth(settings.reader.width);
				setAutoOpenNext(settings.reader.autoNext);
				setSpeechRate(nextSpeechRate);
				setSpeechPitch(nextSpeechPitch);
				setSelectedVoiceURI(settings.reader.voiceURI);
				setHighlightMode(nextHighlightMode);
				setHighlightParagraph(settings.reader.highlightParagraph ?? true);
				setParagraphHighlightColor(nextParagraphHighlightColor);
				setWordHighlightColor(nextWordHighlightColor);
				setSentenceHighlightOpacity(nextSentenceHighlightOpacity);
				setAutoScrollDuringSpeech(settings.reader.autoScrollDuringSpeech ?? true);
				setAutoScrollBehavior(nextAutoScrollBehavior);
				setAutoScrollOffset(nextAutoScrollOffset);
				speechConfigRef.current = {
					rate: nextSpeechRate,
					pitch: nextSpeechPitch,
					voiceURI: settings.reader.voiceURI,
				};
				setSpeechPortalPosition(loadedPortalPosition);
			} catch (err) {
				console.error("Failed to load reader settings:", err);
			} finally {
				if (!cancelled) {
					setReaderSettingsReady(true);
				}
			}
		}

		void loadSettings();

		return () => {
			cancelled = true;
		};
	}, [authLoading, user]);

	useEffect(() => {
		pronunciationRulesRef.current = pronunciationRules;
	}, [pronunciationRules]);

	useEffect(() => {
		if (authLoading || !user || !bookId) {
			pronunciationRulesRef.current = [];
			return;
		}

		let cancelled = false;

		async function loadPronunciationRules() {
			setPronunciationRulesLoading(true);
			setPronunciationRulesError("");
			try {
				const rules = await api.getPronunciationRules(bookId);
				if (!cancelled) {
					pronunciationRulesRef.current = rules;
					setPronunciationRules(rules);
				}
			} catch (err) {
				if (!cancelled) setPronunciationRulesError(getErrorMessage(err, "Could not load pronunciation rules."));
			} finally {
				if (!cancelled) setPronunciationRulesLoading(false);
			}
		}

		void loadPronunciationRules();

		return () => {
			cancelled = true;
		};
	}, [authLoading, user, bookId]);

	const handleCreatePronunciationRule = useCallback(
		async (payload: Parameters<typeof api.createPronunciationRule>[1]) => {
			const rule = await api.createPronunciationRule(bookId, payload);
			setPronunciationRules((prev) => {
				const next = [...prev, rule];
				pronunciationRulesRef.current = next;
				return next;
			});
		},
		[bookId],
	);

	const handleUpdatePronunciationRule = useCallback(async (ruleId: string, payload: Parameters<typeof api.updatePronunciationRule>[1]) => {
		const updated = await api.updatePronunciationRule(ruleId, payload);
		setPronunciationRules((prev) => {
			const next = prev.map((rule) => (rule._id === updated._id ? updated : rule));
			pronunciationRulesRef.current = next;
			return next;
		});
	}, []);

	const handleDeletePronunciationRule = useCallback(async (ruleId: string) => {
		await api.deletePronunciationRule(ruleId);
		setPronunciationRules((prev) => {
			const next = prev.filter((rule) => rule._id !== ruleId);
			pronunciationRulesRef.current = next;
			return next;
		});
	}, []);

	useEffect(() => {
		ttsStatusRef.current = ttsStatus;
	}, [ttsStatus]);

	useEffect(() => {
		speechConfigRef.current = {
			rate: speechRate,
			pitch: speechPitch,
			voiceURI: selectedVoiceURI,
		};
	}, [selectedVoiceURI, speechPitch, speechRate]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		if (speechSupported) {
			const loadVoices = () => {
				setAvailableVoices(window.speechSynthesis.getVoices());
			};

			loadVoices();
			window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
			return () => window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
		}
	}, [speechSupported]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		hasUserInteractedRef.current = window.sessionStorage.getItem(TTS_SESSION_FLAG) === "1";

		const markInteracted = () => {
			hasUserInteractedRef.current = true;
			window.sessionStorage.setItem(TTS_SESSION_FLAG, "1");
		};

		window.addEventListener("pointerdown", markInteracted, { passive: true });
		window.addEventListener("keydown", markInteracted, { passive: true });

		return () => {
			window.removeEventListener("pointerdown", markInteracted);
			window.removeEventListener("keydown", markInteracted);
		};
	}, []);

	const buildSpeechBlocks = useCallback((): SpeechBlock[] => {
		const root = readerContentRef.current;
		if (!root) return [];

		return Array.from(root.querySelectorAll<HTMLElement>(SPEECH_BLOCK_SELECTOR))
			.filter((element) => isSpeechLeafBlock(element))
			.map((element) => ({
				element,
				text: (element.textContent || "").replace(/\s+/g, " ").trim(),
			}))
			.filter((block) => block.text.length > 0);
	}, []);

	const getSpeechBlocks = useCallback((): SpeechBlock[] => {
		// Bulletproof self-healing cache: If cached nodes are detached from DOM, force update
		const isCacheStale = speechBlocksRef.current.length === 0 || speechBlocksRef.current.some((block) => !document.body.contains(block.element));

		if (isCacheStale) {
			const blocks = buildSpeechBlocks();
			speechBlocksRef.current = blocks;
			return blocks;
		}

		return speechBlocksRef.current;
	}, [buildSpeechBlocks]);

	const clearSpeakingBlock = useCallback(() => {
		// O(1) clearance using persistent reference to prevent redundant DOM queries
		if (activeSpeechElementRef.current) {
			activeSpeechElementRef.current.classList.remove("reader-speaking-block");
			activeSpeechElementRef.current.classList.remove("reader-speaking-sentence");
			activeSpeechElementRef.current = null;
		}
	}, []);

	const clearSpeakingWord = useCallback(() => {
		const activeWord = activeWordHighlightRef.current;
		if (!activeWord) return;

		const parent = activeWord.parentNode;
		if (!parent) {
			activeWordHighlightRef.current = null;
			return;
		}

		while (activeWord.firstChild) {
			parent.insertBefore(activeWord.firstChild, activeWord);
		}
		parent.removeChild(activeWord);
		if (parent instanceof HTMLElement) {
			parent.normalize();
		}
		activeWordHighlightRef.current = null;
	}, []);

	const clearSpeakingHighlights = useCallback(() => {
		clearSpeakingWord();
		clearSpeakingBlock();
	}, [clearSpeakingBlock, clearSpeakingWord]);

	const highlightSpeechBlock = useCallback(
		(blockIndex: number) => {
			const blocks = getSpeechBlocks();
			const block = blocks[blockIndex];
			if (!block) return;

			clearSpeakingWord();
			clearSpeakingBlock();
			activeSpeechBlockIndexRef.current = blockIndex;

			const shouldHighlightParagraph = highlightMode !== "off" && highlightParagraph;
			if (shouldHighlightParagraph) {
				block.element.classList.add("reader-speaking-block");
			}
			if (highlightMode === "word") {
				block.element.classList.add("reader-speaking-sentence");
			}
			activeSpeechElementRef.current = block.element;

			if (!autoScrollDuringSpeech) return;

			const rect = block.element.getBoundingClientRect();
			const scrollContainer = getScrollParent(block.element);

			// Center element calculation: Target is always centering the current block in the screen
			if (scrollContainer === window) {
				const elementCenterInPage = window.scrollY + rect.top + rect.height / 2;
				const viewportHeight = window.innerHeight;
				const targetScrollY = elementCenterInPage - viewportHeight / 2;
				window.scrollTo({
					top: Math.max(0, targetScrollY),
					behavior: autoScrollBehavior === "smooth" ? "smooth" : "auto",
				});
			} else {
				const containerElement = scrollContainer as HTMLElement;
				const containerRect = containerElement.getBoundingClientRect();
				const relativeElementCenter = rect.top - containerRect.top + rect.height / 2;
				const targetScrollTop = containerElement.scrollTop + relativeElementCenter - containerRect.height / 2;
				containerElement.scrollTo({
					top: Math.max(0, targetScrollTop),
					behavior: autoScrollBehavior === "smooth" ? "smooth" : "auto",
				});
			}
		},
		[autoScrollBehavior, autoScrollDuringSpeech, clearSpeakingBlock, clearSpeakingWord, getSpeechBlocks, highlightMode, highlightParagraph],
	);

	const highlightSpeechWord = useCallback(
		(blockIndex: number, absoluteCharIndex: number) => {
			if (highlightMode !== "word") return;
			const blocks = getSpeechBlocks();
			const block = blocks[blockIndex];
			if (!block || !block.element) return;

			const text = block.text;
			const safeIndex = Math.max(0, Math.min(absoluteCharIndex, Math.max(0, text.length - 1)));
			let start = safeIndex;
			let end = safeIndex;
			const isWordChar = (char: string) => /[^\s.,!?;:()[\]{}"'`]/.test(char);

			while (start > 0 && isWordChar(text[start - 1] || "")) start -= 1;
			while (end < text.length && isWordChar(text[end] || "")) end += 1;
			if (start >= end) return;

			clearSpeakingWord();

			let accumulated = 0;
			let startNode: Text | null = null;
			let endNode: Text | null = null;
			let startOffsetInNode = 0;
			let endOffsetInNode = 0;

			const walker = document.createTreeWalker(block.element, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const textNode = node as Text;
				const nodeLength = textNode.nodeValue?.length ?? 0;
				if (!startNode && start >= accumulated && start <= accumulated + nodeLength) {
					startNode = textNode;
					startOffsetInNode = Math.max(0, start - accumulated);
				}
				if (end >= accumulated && end <= accumulated + nodeLength) {
					endNode = textNode;
					endOffsetInNode = Math.max(0, end - accumulated);
					break;
				}
				accumulated += nodeLength;
			}

			// Block highlights across multiple textual element boundaries to avoid DOM breakage
			if (!startNode || !endNode || startNode !== endNode || endOffsetInNode <= startOffsetInNode) {
				return;
			}

			const range = document.createRange();
			range.setStart(startNode, startOffsetInNode);
			range.setEnd(endNode, endOffsetInNode);

			const highlight = document.createElement("span");
			highlight.className = "reader-speaking-word";
			try {
				range.surroundContents(highlight);
				activeWordHighlightRef.current = highlight;
			} catch {
				highlight.remove();
			}
		},
		[clearSpeakingWord, getSpeechBlocks, highlightMode],
	);

	const createSpeechQueueFromBlock = useCallback(
		(startBlockIndex: number): SpeechQueueItem[] => {
			const blocks = getSpeechBlocks();
			const safeStartIndex = Math.min(Math.max(0, startBlockIndex), Math.max(0, blocks.length - 1));
			const queue: SpeechQueueItem[] = [];
			const rules = pronunciationRulesRef.current;

			for (let blockIndex = safeStartIndex; blockIndex < blocks.length; blockIndex += 1) {
				for (const chunk of splitSpeechTextWithOffsets(blocks[blockIndex].text)) {
					queue.push({
						text: chunk.text,
						spokenText: applyPronunciationRules(chunk.text, rules),
						blockIndex,
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
			if (!options?.preserveContinuation) {
				shouldContinueSpeechRef.current = false;
			}
			if (speechStartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechStartTimerRef.current);
				speechStartTimerRef.current = null;
			}
			if (speechRestartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechRestartTimerRef.current);
				speechRestartTimerRef.current = null;
			}
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				// CRITICAL PREVENT autoplay block: Keep the speech engine talking (not cancelled)
				// when unmounting and transitioning to the next unit so session remains active.
				if (!options?.preserveContinuation) {
					activeUtteranceRef.current = null;
					window.speechSynthesis.cancel();
				}
			}
			speechQueueRef.current = [];
			speechIndexRef.current = 0;
			activeSpeechBlockIndexRef.current = null;
			activeQueueItemRef.current = null;
			clearSpeakingHighlights();
			if (!options?.preserveContinuation) {
				ttsStatusRef.current = "idle";
				setTtsStatus("idle");
			}
		},
		[clearSpeakingHighlights],
	);

	useEffect(() => {
		return () => {
			stopSpeech();
		};
	}, [stopSpeech]);

	useEffect(() => {
		const shouldResumeAfterLoad = shouldContinueSpeechRef.current;
		stopSpeech({ preserveContinuation: shouldResumeAfterLoad });
		speechBlocksRef.current = [];
		if (typeof window !== "undefined") {
			window.scrollTo({ top: 0, behavior: "auto" });
		}
	}, [unitNumber, stopSpeech]);

	useEffect(() => {
		let cancelled = false;

		async function loadUnit() {
			if (!bookId || Number.isNaN(unitNumber)) return;
			setLoading(true);
			setError("");
			setUnit(null);
			setAdminActionMessage("");

			try {
				const [bookData, unitsData] = isRawReader
					? await Promise.all([api.getPublicBook(bookId), api.getPublicRawUnits(bookId)])
					: await Promise.all([api.getPublicBook(bookId), api.getPublicUnits(bookId)]);
				if (cancelled) return;
				setBook(bookData);
				setUnits(unitsData);

				try {
					const unitData = isRawReader
						? await api.getPublicRawUnit(bookId, unitNumber)
						: await api.getPublicUnit(bookId, unitNumber);
					if (cancelled) return;
					setUnit(unitData);

					if (user && !isRawReader) {
						void api.recordBookVisit(bookId, unitData.unitNumber).catch((visitErr) => {
							console.error("Failed to record unit revisit:", visitErr);
						});

						if (unitData.unitNumber > bookData.unitsRead) {
							void api.updateBook(bookId, { unitsRead: unitData.unitNumber }).catch((updateErr) => {
								console.error("Failed to update reading progress:", updateErr);
							});
						}
					}
				} catch (unitErr: unknown) {
					if (cancelled) return;
					setError(getErrorMessage(unitErr, "This unit has not been archived yet."));
				}
			} catch (err: unknown) {
				if (cancelled) return;
				console.error("Failed to load unit content:", err);
				setError(getErrorMessage(err, "Could not load this reader page."));
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadUnit();

		return () => {
			cancelled = true;
		};
	}, [isRawReader, user, bookId, unitNumber]);

	// Instantly clear blocks on navigation or new contents to prevent stale tracking
	useEffect(() => {
		speechBlocksRef.current = [];
		activeSpeechElementRef.current = null;
		activeWordHighlightRef.current = null;
	}, [unit?.content, unitNumber]);

	const catalogItems = useMemo<CatalogUnit[]>(() => {
		if (!book) return [];

		const archivedByNumber = new Map(units.map((item) => [item.unitNumber, item]));
		const seen = new Set<number>();
		const items: CatalogUnit[] = [];

		const indexedUnits = isRawReader ? book.rawUnitsList || [] : book.translatedUnitsList || [];

		for (const indexed of indexedUnits) {
			if (!indexed.unitNumber || seen.has(indexed.unitNumber)) continue;
			const archived = archivedByNumber.get(indexed.unitNumber);
			items.push({
				unitNumber: indexed.unitNumber,
				title: resolveUnitTitle(book.title, indexed.unitNumber, archived?.title, indexed.title),
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || indexed.url,
				scrapedAt: archived?.scrapedAt,
			});
			seen.add(indexed.unitNumber);
		}

		for (const archived of units) {
			if (seen.has(archived.unitNumber)) continue;
			items.push({
				unitNumber: archived.unitNumber,
				title: resolveUnitTitle(book.title, archived.unitNumber, archived.title),
				archived: true,
				sourceUrl: archived.sourceUrl,
				scrapedAt: archived.scrapedAt,
			});
			seen.add(archived.unitNumber);
		}

		return items.sort((a, b) => a.unitNumber - b.unitNumber);
	}, [isRawReader, book, units]);

	const filteredCatalogItems = useMemo(() => {
		const query = catalogSearch.trim().toLowerCase();
		if (!query) return catalogItems;

		return catalogItems.filter((item) => item.title.toLowerCase().includes(query) || item.unitNumber.toString().includes(query));
	}, [catalogItems, catalogSearch]);

	const currentCatalogIndex = useMemo(() => catalogItems.findIndex((item) => item.unitNumber === unitNumber), [catalogItems, unitNumber]);
	const currentCatalogItem = currentCatalogIndex >= 0 ? catalogItems[currentCatalogIndex] : undefined;
	const readerSourceKind: SourceKind = isRawReader ? "raw" : "translated";
	const archiveJobType: JobType = isRawReader ? "scrape_raw_units" : "scrape_units";
	const currentSourceUrl = currentCatalogItem?.sourceUrl || unit?.sourceUrl || "";
	const missingUnitTitle = currentCatalogItem?.title || `${isRawReader ? "Raw unit" : "Unit"} ${unitNumber}`;

	const previousUnitNumber = currentCatalogIndex > 0 ? catalogItems[currentCatalogIndex - 1].unitNumber : unitNumber - 1;
	const nextUnitNumber =
		currentCatalogIndex >= 0 && currentCatalogIndex < catalogItems.length - 1 ? catalogItems[currentCatalogIndex + 1].unitNumber : unitNumber + 1;
	const hasPreviousUnit = currentCatalogIndex >= 0 ? currentCatalogIndex > 0 : unitNumber > 1;
	const hasNextUnit =
		currentCatalogIndex >= 0
			? currentCatalogIndex < catalogItems.length - 1
			: Boolean(
					book &&
					!(
						(isRawReader ? book.rawUnitsTotal : book.translatedUnitsTotal) > 0 &&
						unitNumber >= (isRawReader ? book.rawUnitsTotal : book.translatedUnitsTotal)
					),
				);

	const indexedCurrentTitle = useMemo(() => {
		const indexedUnits = isRawReader ? book?.rawUnitsList : book?.translatedUnitsList;
		return indexedUnits?.find((item) => item.unitNumber === unitNumber)?.title;
	}, [isRawReader, book, unitNumber]);

	const displayUnitTitle = useMemo(() => {
		if (!book || !unit) return `Unit ${unitNumber}`;
		return resolveUnitTitle(book.title, unit.unitNumber, unit.title, indexedCurrentTitle);
	}, [unit, unitNumber, indexedCurrentTitle, book]);

	const navigateToUnit = useCallback(
		(nextChNum: number, options?: { resumeTts?: boolean }) => {
			const query = new URLSearchParams();
			if (readingSource === "raw") query.set("source", "raw");
			if (options?.resumeTts) query.set("tts", "1");
			const queryString = query.toString();
			router.push(`/books/${bookId}/reader/${nextChNum}${queryString ? `?${queryString}` : ""}`);
		},
		[bookId, readingSource, router],
	);

	const switchReaderSource = useCallback(
		(source: ReaderSource) => {
			const query = new URLSearchParams();
			if (source === "raw") query.set("source", "raw");
			router.push(`/books/${bookId}/reader/${unitNumber}${query.toString() ? `?${query.toString()}` : ""}`);
		},
		[unitNumber, bookId, router],
	);

	const handleGenerateTranslation = useCallback(async () => {
		if (!bookId || !unit) return;
		setTranslatingRawUnit(true);
		setError("");

		try {
			await api.translateRawUnit(bookId, unit.unitNumber, { targetLanguage: "English" });
			router.push(`/books/${bookId}/reader/${unit.unitNumber}`);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Could not generate translated unit."));
		} finally {
			setTranslatingRawUnit(false);
		}
	}, [unit, bookId, router]);

	const reloadCurrentUnit = useCallback(async () => {
		const [unitData, unitsData] = isRawReader
			? await Promise.all([api.getPublicRawUnit(bookId, unitNumber), api.getPublicRawUnits(bookId)])
			: await Promise.all([api.getPublicUnit(bookId, unitNumber), api.getPublicUnits(bookId)]);

		setUnit(unitData);
		setUnits(unitsData);
		setError("");
	}, [unitNumber, isRawReader, bookId]);

	const handleScrapeCurrentUnitNow = useCallback(async () => {
		if (!book) return;

		setAdminScrapingUnit(true);
		setAdminActionMessage("");
		try {
			const result = await api.runScrapeNow(bookId, archiveJobType, { unitNumber });
			setBook(result.book);
			await reloadCurrentUnit();
			setAdminActionMessage(result.message || "Unit archived.");
		} catch (err: unknown) {
			setAdminActionMessage(getErrorMessage(err, "Could not archive this unit."));
		} finally {
			setAdminScrapingUnit(false);
		}
	}, [archiveJobType, unitNumber, book, bookId, reloadCurrentUnit]);

	const handleImportCurrentUnitHtml = useCallback(
		async (event: React.FormEvent) => {
			event.preventDefault();
			if (!book) return;

			setImportingUnitHtml(true);
			setAdminActionMessage("");
			try {
				const result = await api.importUnitHtml(bookId, {
					sourceKind: readerSourceKind,
					unitNumber,
					pageUrl: unitHtmlPageUrl || currentSourceUrl,
					html: unitHtmlContent,
				});
				await reloadCurrentUnit();
				setAdminActionMessage(result.message || "Unit HTML imported.");
				setUnitHtmlContent("");
			} catch (err: unknown) {
				setAdminActionMessage(getErrorMessage(err, "Could not import unit HTML."));
			} finally {
				setImportingUnitHtml(false);
			}
		},
		[unitHtmlContent, unitHtmlPageUrl, unitNumber, currentSourceUrl, book, bookId, readerSourceKind, reloadCurrentUnit],
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

				if (shouldContinueSpeechRef.current && hasNextUnit) {
					// CRITICAL keep-alive queue continuation:
					// Before letting the speech queue completely clear and navigating (which marks speech session as idle),
					// play a transient, natural keep-alive voice indicator. This keeps the global SpeechSynthesis engine
					// actively talking, meaning when the next page mounts programmatically, the engine can be hijacked
					// and updated without losing the user gesture authorization boundary or triggering "not-allowed".
					const transitionalPrompt = new SpeechSynthesisUtterance("Loading next unit.");
					transitionalPrompt.rate = speechConfigRef.current.rate;
					transitionalPrompt.pitch = speechConfigRef.current.pitch;
					const selectedVoice = availableVoices.find((voice) => voice.voiceURI === speechConfigRef.current.voiceURI);
					if (selectedVoice) {
						transitionalPrompt.voice = selectedVoice;
					}
					window.speechSynthesis.speak(transitionalPrompt);

					navigateToUnit(nextUnitNumber, { resumeTts: true });
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
			hasNextUnit,
			highlightMode,
			highlightSpeechBlock,
			highlightSpeechWord,
			navigateToUnit,
			nextUnitNumber,
		],
	);

	useEffect(() => {
		speakQueuedChunkRef.current = speakQueuedChunk;
	}, [speakQueuedChunk]);

	const startSpeechFromBlock = useCallback(
		(startBlockIndex: number, options?: { continueAcrossUnits?: boolean; fromUserGesture?: boolean }): boolean => {
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

			shouldContinueSpeechRef.current = Boolean(options?.continueAcrossUnits);
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
		const continueAcrossUnits = shouldContinueSpeechRef.current;

		if (speechRestartTimerRef.current !== null) {
			window.clearTimeout(speechRestartTimerRef.current);
		}

		speechRestartTimerRef.current = window.setTimeout(() => {
			speechRestartTimerRef.current = null;
			if (ttsStatusRef.current !== "playing") return;
			void startSpeechFromBlock(startBlockIndex, { continueAcrossUnits });
		}, 180);
	}, [speechSupported, startSpeechFromBlock]);

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

		void startSpeechFromBlock(0, { continueAcrossUnits: autoOpenNext, fromUserGesture: true });
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
			!unit ||
			!shouldAutoStartSpeech ||
			startedAutoSpeechForUnitRef.current === unitNumber
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
			const didStart = startSpeechFromBlock(0, { continueAcrossUnits: true });
			if (didStart) {
				startedAutoSpeechForUnitRef.current = unitNumber;
			}
		}, 250); // Small margin to let dangerouslySetInnerHTML finish committing and parsing in the document layout

		return () => window.clearTimeout(timer);
	}, [authLoading, unit, unitNumber, loading, readerSettingsReady, shouldResumeTtsFromRoute, speechSupported, startSpeechFromBlock, buildSpeechBlocks]);

	const handleThemeChange = (newTheme: ReaderTheme) => {
		setTheme(newTheme);
		persistReaderSettings({ theme: newTheme });
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
		if (!enabled) {
			shouldContinueSpeechRef.current = false;
		}
		persistReaderSettings({ autoNext: enabled });
	};

	const handleSpeechRateChange = (rate: number) => {
		const nextRate = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, rate));
		speechConfigRef.current = { ...speechConfigRef.current, rate: nextRate };
		setSpeechRate(nextRate);
		persistReaderSettings({ speechRate: nextRate });
		restartSpeechFromCurrentBlock();
	};

	const handleSpeechPitchChange = (pitch: number) => {
		const nextPitch = Math.min(SPEECH_PITCH_MAX, Math.max(SPEECH_PITCH_MIN, pitch));
		speechConfigRef.current = { ...speechConfigRef.current, pitch: nextPitch };
		setSpeechPitch(nextPitch);
		persistReaderSettings({ speechPitch: nextPitch });
		restartSpeechFromCurrentBlock();
	};

	const handleVoiceChange = (voiceURI: string) => {
		speechConfigRef.current = { ...speechConfigRef.current, voiceURI };
		setSelectedVoiceURI(voiceURI);
		persistReaderSettings({ voiceURI });
		restartSpeechFromCurrentBlock();
	};

	const handleHighlightModeChange = (mode: ReaderHighlightMode) => {
		setHighlightMode(mode);
		persistReaderSettings({ highlightMode: mode });
	};

	const handleHighlightParagraphChange = (enabled: boolean) => {
		setHighlightParagraph(enabled);
		persistReaderSettings({ highlightParagraph: enabled });
	};

	const handleParagraphHighlightColorChange = (nextColor: string) => {
		const normalized = normalizeHexColor(nextColor, DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR);
		setParagraphHighlightColor(normalized);
		persistReaderSettings({ paragraphHighlightColor: normalized });
	};

	const handleWordHighlightColorChange = (nextColor: string) => {
		const normalized = normalizeHexColor(nextColor, DEFAULT_WORD_HIGHLIGHT_COLOR);
		setWordHighlightColor(normalized);
		persistReaderSettings({ wordHighlightColor: normalized });
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

	const handleReaderContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const root = readerContentRef.current;
		const target = event.target as HTMLElement | null;
		if (!root || !target) return;

		const block = target.closest(SPEECH_BLOCK_SELECTOR) as HTMLElement | null;
		if (!block || !root.contains(block)) return;
		if (!isSpeechLeafBlock(block)) return;

		let blocks = getSpeechBlocks();
		let blockIndex = blocks.findIndex((item) => item.element === block);

		// Rebuild references immediately if they are stale due to React mutations
		if (blockIndex < 0) {
			speechBlocksRef.current = buildSpeechBlocks();
			blocks = speechBlocksRef.current;
			blockIndex = blocks.findIndex((item) => item.element === block);
		}

		if (blockIndex < 0) return;

		void startSpeechFromBlock(blockIndex, { continueAcrossUnits: autoOpenNext, fromUserGesture: true });
	};

	if (loading) {
		return (
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-primary)" }}>
				<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
					<div className="spinner" style={{ width: "40px", height: "40px" }}></div>
					<span style={{ color: "var(--text-secondary)" }}>Retrieving archived unit...</span>
				</div>
			</div>
		);
	}

	if (error || !unit || !book) {
		return (
			<div className="container">
				<div className="glass-card empty-state">
					<h2 style={{ color: "var(--danger)", marginBottom: "1rem" }}>{missingUnitTitle}</h2>
					<p style={{ maxWidth: "520px", color: "var(--text-secondary)", margin: "0 auto 2rem" }}>
						{error || "This unit has not been archived yet."}
					</p>
					<div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
						<Link href={`/books/${bookId}`} className="btn btn-secondary">
							Back to Book Index
						</Link>
						{currentSourceUrl && (
							<a href={currentSourceUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
								Open Source Page
							</a>
						)}
					</div>

					{hasCapability(CAPABILITY.JOBS_SCRAPE) && book && (
						<div
							className="glass-card"
							style={{
								width: "min(820px, 100%)",
								margin: "2rem auto 0",
								padding: "1.5rem",
								textAlign: "left",
							}}
						>
							<h3 style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>Admin Recovery</h3>
							<p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
								Archive this {isRawReader ? "raw" : "translated"} unit now, or paste the saved HTML for this source page.
							</p>

							<div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
								<button
									type="button"
									className="btn btn-primary"
									onClick={handleScrapeCurrentUnitNow}
									disabled={adminScrapingUnit || !currentCatalogItem?.sourceUrl}
								>
									{adminScrapingUnit ? "Scraping..." : "Scrape This Unit Now"}
								</button>
								{currentSourceUrl && (
									<a href={currentSourceUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
										Open Source
									</a>
								)}
							</div>

							<form key={`${readerSourceKind}-${unitNumber}`} onSubmit={handleImportCurrentUnitHtml} style={{ display: "grid", gap: "1rem" }}>
								<div className="form-group" style={{ marginBottom: 0 }}>
									<label className="form-label">Unit Page URL</label>
									<input
										type="url"
										className="form-input"
										value={unitHtmlPageUrl || currentSourceUrl}
										onChange={(event) => setUnitHtmlPageUrl(event.target.value)}
										placeholder="https://example.com/unit"
										required
									/>
								</div>

								<div className="form-group" style={{ marginBottom: 0 }}>
									<label className="form-label">Saved Unit HTML</label>
									<textarea
										className="form-textarea"
										rows={10}
										value={unitHtmlContent}
										onChange={(event) => setUnitHtmlContent(event.target.value)}
										placeholder="<html>..."
										required
									/>
								</div>

								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
									<span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
										{readerSourceKind === "raw" ? "Raw unit" : "Translated unit"} {unitNumber}
									</span>
									<button type="submit" className="btn btn-primary" disabled={importingUnitHtml}>
										{importingUnitHtml ? "Importing..." : "Import HTML"}
									</button>
								</div>
							</form>

							{adminActionMessage && (
								<p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "1rem" }}>{adminActionMessage}</p>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	const widthStyle = {
		narrow: "650px",
		medium: "850px",
		wide: "1120px",
	}[readWidth];
	const readerContentStyle = {
		fontSize: `${fontSize}px`,
		"--reader-highlight-paragraph": paragraphHighlightColor,
		"--reader-highlight-word": wordHighlightColor,
		"--reader-sentence-opacity": String(sentenceHighlightOpacity),
	} as React.CSSProperties;
	const themeClass = `reader-theme-${theme}`;

	return (
		<>
			<style>{`
				.reader-content .reader-speaking-block {
					background-color: var(--reader-highlight-paragraph) !important;
					border-radius: 4px;
					box-shadow: 0 0 0 4px var(--reader-highlight-paragraph) !important;
					transition: background-color 0.15s ease, box-shadow 0.15s ease;
				}
				.reader-speaking-word {
					background-color: var(--reader-highlight-word) !important;
					color: #000 !important;
					border-radius: 2px;
				}
			`}</style>
			<div className={`${themeClass} reader-shell`}>
				<div className="reader-toolbar max-[860px]:gap-2 max-[860px]:px-3 max-[860px]:py-[0.65rem]">
					<div className="reader-toolbar-primary w-full flex-wrap justify-between gap-2">
						<button className="reader-tool-button" onClick={() => setIsCatalogOpen(true)}>
							Catalogue
						</button>
						<Link href={`/books/${bookId}`} className="reader-back-link">
							← {book.title.length > 24 ? `${book.title.substring(0, 24)}...` : book.title}
						</Link>
						<div className="reader-toolbar-actions">
							<button className="reader-tool-button" onClick={handlePlaySpeech}>
								Listen
							</button>
							<button
								className="reader-tool-button"
								onClick={() => {
									setReaderPanelTab("display");
									setIsReaderPanelOpen(true);
								}}
							>
								Controls
							</button>
						</div>
					</div>
				</div>

				{isCatalogOpen && (
					<div className="reader-catalog-backdrop" onClick={() => setIsCatalogOpen(false)}>
						<aside className="reader-catalog-panel" onClick={(event) => event.stopPropagation()}>
							<div className="reader-catalog-header">
								<div>
									<h2>Catalogue</h2>
									<p>
										{isRawReader ? "Raw" : "Translated"} · {catalogItems.length} units indexed, {units.length} archived.
									</p>
								</div>
								<button className="reader-tool-button" onClick={() => setIsCatalogOpen(false)}>
									Close
								</button>
							</div>

							<input
								className="reader-catalog-search"
								value={catalogSearch}
								onChange={(event) => setCatalogSearch(event.target.value)}
								placeholder="Search unit number or title"
							/>

							<div className="reader-catalog-list">
								{filteredCatalogItems.map((item) => (
									<button
										key={item.unitNumber}
										className={`reader-catalog-item ${item.unitNumber === unitNumber ? "active" : ""}`}
										onClick={() => {
											setIsCatalogOpen(false);
											navigateToUnit(item.unitNumber);
										}}
									>
										<span>Unit {item.unitNumber}</span>
										<strong>{item.title}</strong>
										<small>{item.archived ? "Archived" : "Indexed only"}</small>
									</button>
								))}
							</div>
						</aside>
					</div>
				)}

				<main className="reader-page max-[860px]:px-3 max-[860px]:py-5">
					<article className="reader-article" style={{ maxWidth: widthStyle }}>
						<header className="reader-unit-header">
							<h1>{displayUnitTitle}</h1>
							<div className="reader-unit-meta max-[860px]:flex-col max-[860px]:items-start">
								<span>{book.title}</span>
								<span>
									{isRawReader ? "Raw" : "Translated"} unit {unit.unitNumber}{" "}
									{(isRawReader ? book.rawUnitsTotal : book.translatedUnitsTotal)
										? `of ${isRawReader ? book.rawUnitsTotal : book.translatedUnitsTotal}`
										: ""}
								</span>
								{unit.sourceUrl && (
									<a href={unit.sourceUrl} target="_blank" rel="noreferrer">
										Original Source
									</a>
								)}
							</div>
							{isRawReader && hasCapability(CAPABILITY.UNITS_TRANSLATE) && (
								<div className="mx-auto mt-4 flex w-fit max-w-[min(92vw,640px)] flex-wrap items-center justify-center gap-3 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-[0.45rem] text-[0.78rem] font-bold text-[var(--reader-muted)]">
									<span>Raw source view</span>
									<button className="reader-tool-button" onClick={handleGenerateTranslation} disabled={translatingRawUnit}>
										{translatingRawUnit ? "Generating..." : "Generate English Translation"}
									</button>
								</div>
							)}
						</header>

						<div
							ref={readerContentRef}
							className="reader-content"
							style={readerContentStyle}
							onClick={handleReaderContentClick}
							dangerouslySetInnerHTML={{ __html: unit.content }}
						/>

						<footer className="reader-footer">
							<button
								className="btn btn-secondary"
								style={{ color: "var(--reader-text)", borderColor: "var(--reader-border)", backgroundColor: "transparent" }}
								disabled={!hasPreviousUnit}
								onClick={() => navigateToUnit(previousUnitNumber)}
							>
								← Previous Unit
							</button>

							<button className="reader-tool-button" onClick={() => setIsCatalogOpen(true)}>
								Open Catalogue
							</button>

							<button className="btn btn-primary" disabled={!hasNextUnit} onClick={() => navigateToUnit(nextUnitNumber)}>
								Next Unit →
							</button>
						</footer>
					</article>
				</main>

				<SpeechWidget
					supported={speechSupported}
					status={ttsStatus}
					error={speechError}
					onPlay={handlePlaySpeech}
					onPause={handlePauseSpeech}
					onStop={() => stopSpeech()}
					onPrevUnit={() => navigateToUnit(previousUnitNumber)}
					onNextUnit={() => navigateToUnit(nextUnitNumber)}
					hasPrevUnit={hasPreviousUnit}
					hasNextUnit={hasNextUnit}
					voices={availableVoices}
					voiceURI={selectedVoiceURI}
					onVoiceChange={handleVoiceChange}
					position={speechPortalPosition}
					onPositionChange={handleSpeechPortalPositionChange}
					onOpenSettings={() => {
						setReaderPanelTab("speech");
						setIsReaderPanelOpen(true);
					}}
					isBottomToolbarOpen={isReaderPanelOpen}
				/>

				<ReaderBottomToolbar
					isOpen={isReaderPanelOpen}
					onOpenChange={setIsReaderPanelOpen}
					activeTab={readerPanelTab}
					onTabChange={setReaderPanelTab}
					onPreviousUnit={() => navigateToUnit(previousUnitNumber)}
					onNextUnit={() => navigateToUnit(nextUnitNumber)}
					onOpenCatalog={() => setIsCatalogOpen(true)}
					hasPreviousUnit={hasPreviousUnit}
					hasNextUnit={hasNextUnit}
					previousUnitNumber={previousUnitNumber}
					nextUnitNumber={nextUnitNumber}
					catalogItemsLength={catalogItems.length}
					bookId={bookId}
					bookTitle={book.title}
					theme={theme}
					onThemeChange={handleThemeChange}
					fontSize={fontSize}
					onFontSizeDecrease={() => handleFontSizeChange(false)}
					onFontSizeIncrease={() => handleFontSizeChange(true)}
					readWidth={readWidth}
					onReadWidthChange={handleWidthChange}
					voices={availableVoices}
					voiceURI={selectedVoiceURI}
					onVoiceChange={handleVoiceChange}
					rate={speechRate}
					onRateChange={handleSpeechRateChange}
					pitch={speechPitch}
					onPitchChange={handleSpeechPitchChange}
					highlightMode={highlightMode}
					onHighlightModeChange={handleHighlightModeChange}
					highlightParagraph={highlightParagraph}
					onHighlightParagraphChange={handleHighlightParagraphChange}
					paragraphColor={paragraphHighlightColor}
					onParagraphColorChange={handleParagraphHighlightColorChange}
					wordColor={wordHighlightColor}
					onWordColorChange={handleWordHighlightColorChange}
					sentenceHighlightOpacity={sentenceHighlightOpacity}
					onSentenceHighlightOpacityChange={handleSentenceHighlightOpacityChange}
					autoScrollDuringSpeech={autoScrollDuringSpeech}
					onAutoScrollDuringSpeechChange={handleAutoScrollDuringSpeechChange}
					autoScrollBehavior={autoScrollBehavior}
					onAutoScrollBehaviorChange={handleAutoScrollBehaviorChange}
					autoScrollOffset={autoScrollOffset}
					onAutoScrollOffsetChange={handleAutoScrollOffsetChange}
					autoOpenNext={autoOpenNext}
					onAutoOpenNextChange={handleAutoOpenNextChange}
					pronunciationRulesEnabled={!!user}
					onOpenPronunciationRules={() => setIsPronunciationModalOpen(true)}
					isRawReader={isRawReader}
					readerSourceKind={readerSourceKind}
					switchReaderSource={switchReaderSource}
					hasRawUnits={book.rawUnitsTotal > 0}
					sourceUrl={unit.sourceUrl}
					onScrollToTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
					isLoggedIn={!!user}
				/>

				<PronunciationRulesModal
					open={isPronunciationModalOpen}
					onClose={() => setIsPronunciationModalOpen(false)}
					bookTitle={book.title || ""}
					rules={pronunciationRules}
					loading={pronunciationRulesLoading}
					error={pronunciationRulesError}
					onCreate={handleCreatePronunciationRule}
					onUpdate={handleUpdatePronunciationRule}
					onDelete={handleDeletePronunciationRule}
				/>

			</div>
		</>
	);
}
