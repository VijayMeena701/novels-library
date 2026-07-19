"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	api,
	type Book,
	type ChapterContent,
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
const DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR = "#f5d67a";
const DEFAULT_WORD_HIGHLIGHT_COLOR = "#f59e0b";
const TTS_SESSION_FLAG = "books_reader_user_started_tts";

interface SpeechChunk {
	text: string;
	startOffset: number;
}

interface CatalogChapter {
	chapterNumber: number;
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

function isGenericChapterTitle(value: string, bookTitle: string, chapterNumber: number): boolean {
	const normalized = normalizeTitle(value);
	return !normalized || normalized === normalizeTitle(bookTitle) || normalized === `chapter ${chapterNumber}` || normalized === `ch ${chapterNumber}`;
}

function resolveChapterTitle(bookTitle: string, chapterNumber: number, archivedTitle?: string, indexedTitle?: string): string {
	const archived = archivedTitle?.trim() || "";
	const indexed = indexedTitle?.trim() || "";

	if (indexed && isGenericChapterTitle(archived, bookTitle, chapterNumber)) {
		return indexed;
	}

	return archived || indexed || `Chapter ${chapterNumber}`;
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

export default function ReaderView({ params }: { params: Promise<{ id: string; chapterNumber: string }> | { id: string; chapterNumber: string } }) {
	const resolvedParams = params instanceof Promise ? use(params) : params;
	const { id: bookId, chapterNumber: chNumStr } = resolvedParams;

	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading: authLoading, hasCapability } = useAuth();

	const chapterNumber = parseInt(chNumStr, 10);
	const shouldResumeTtsFromRoute = searchParams.get("tts") === "1";
	const readingSource: ReaderSource = searchParams.get("source") === "raw" ? "raw" : "translated";
	const isRawReader = readingSource === "raw";

	const [book, setBook] = useState<Book | null>(null);
	const [chapter, setChapter] = useState<ChapterContent | null>(null);
	const [chapters, setChapters] = useState<Omit<ChapterContent, "content">[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [translatingRawChapter, setTranslatingRawChapter] = useState(false);
	const [adminActionMessage, setAdminActionMessage] = useState("");
	const [adminScrapingChapter, setAdminScrapingChapter] = useState(false);
	const [chapterHtmlPageUrl, setChapterHtmlPageUrl] = useState("");
	const [chapterHtmlContent, setChapterHtmlContent] = useState("");
	const [importingChapterHtml, setImportingChapterHtml] = useState(false);

	const [theme, setTheme] = useState<ReaderTheme>("sepia");
	const [fontSize, setFontSize] = useState<number>(18);
	const [readWidth, setReadWidth] = useState<ReaderWidth>("narrow");
	const [autoOpenNext, setAutoOpenNext] = useState(true);
	const [highlightMode, setHighlightMode] = useState<ReaderHighlightMode>("paragraph");
	const [highlightParagraph, setHighlightParagraph] = useState(true);
	const [paragraphHighlightColor, setParagraphHighlightColor] = useState(DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR);
	const [wordHighlightColor, setWordHighlightColor] = useState(DEFAULT_WORD_HIGHLIGHT_COLOR);
	const [sentenceHighlightOpacity, setSentenceHighlightOpacity] = useState(0.35);
	const [autoScrollDuringSpeech, setAutoScrollDuringSpeech] = useState(true);
	const [autoScrollBehavior, setAutoScrollBehavior] = useState<ReaderAutoScrollBehavior>("smooth");
	const [autoScrollOffset, setAutoScrollOffset] = useState(140);
	const [speechRate, setSpeechRate] = useState(1);
	const [speechPitch, setSpeechPitch] = useState(1);
	const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
	const [speechPortalPosition, setSpeechPortalPosition] = useState<{ x: number; y: number }>({ x: 20, y: 80 });

	const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
	const [ttsStatus, setTtsStatus] = useState<TtsStatus>("idle");
	const [speechError, setSpeechError] = useState("");
	const [isCatalogOpen, setIsCatalogOpen] = useState(false);
	const [catalogSearch, setCatalogSearch] = useState("");
	const [isReaderPanelOpen, setIsReaderPanelOpen] = useState(false);
	const [readerPanelTab, setReaderPanelTab] = useState<ReaderPanelTab>("read");

	const [pronunciationRules, setPronunciationRules] = useState<PronunciationRule[]>([]);
	const [pronunciationRulesLoading, setPronunciationRulesLoading] = useState(false);
	const [pronunciationRulesError, setPronunciationRulesError] = useState("");
	const [isPronunciationModalOpen, setIsPronunciationModalOpen] = useState(false);

	const [readerSettingsReady, setReaderSettingsReady] = useState(false);

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
	const speechConfigRef = useRef<{ rate: number; pitch: number; voiceURI: string }>({ rate: 1, pitch: 1, voiceURI: "" });
	const hasUserInteractedRef = useRef(false);
	const pronunciationRulesRef = useRef<PronunciationRule[]>([]);
	const speechRestartTimerRef = useRef<number | null>(null);
	const shouldContinueSpeechRef = useRef(false);
	const startedAutoSpeechForChapterRef = useRef<number | null>(null);
	const readerContentRef = useRef<HTMLDivElement | null>(null);
	const pendingReaderSettingsRef = useRef<Partial<ReaderSettings>>({});
	const settingsSaveTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (window.sessionStorage.getItem(TTS_SESSION_FLAG) === "1" && !hasUserInteractedRef.current) {
			hasUserInteractedRef.current = true;
		}
	}, []);

	const speechSupported = useMemo(() => {
		if (typeof window === "undefined") return false;
		return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
	}, []);

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
	}, []);

	const getSpeechBlocks = useCallback((): SpeechBlock[] => {
		if (speechBlocksRef.current.length > 0) {
			return speechBlocksRef.current;
		}
		speechBlocksRef.current = buildSpeechBlocks();
		return speechBlocksRef.current;
	}, [buildSpeechBlocks]);

	useEffect(() => {
		async function loadPronunciationRules() {
			if (!bookId || !user) return;
			setPronunciationRulesLoading(true);
			setPronunciationRulesError("");
			try {
				const rules = await api.getPronunciationRules(bookId);
				setPronunciationRules(rules);
				pronunciationRulesRef.current = rules;
			} catch (err: unknown) {
				console.error("Failed to load pronunciation rules:", err);
				setPronunciationRulesError("Could not retrieve custom speech rules.");
			} finally {
				setPronunciationRulesLoading(false);
			}
		}

		async function clearPronunciationRules() {
			setPronunciationRules([]);
			pronunciationRulesRef.current = [];
		}

		if (user) {
			void loadPronunciationRules();
		} else {
			void clearPronunciationRules();
		}
	}, [user, bookId]);

	const handleCreatePronunciationRule = async (data: { pattern: string; replacement?: string; wholeWord?: boolean; caseSensitive?: boolean; enabled?: boolean; isGlobal?: boolean }) => {
		if (!bookId) return;
		const created = await api.createPronunciationRule(bookId, data);
		setPronunciationRules((prev) => [created, ...prev]);
		pronunciationRulesRef.current = [created, ...pronunciationRulesRef.current];
		restartSpeechFromCurrentBlock();
	};

	const handleUpdatePronunciationRule = async (ruleId: string, data: { pattern?: string; replacement?: string; wholeWord?: boolean; caseSensitive?: boolean; enabled?: boolean; isGlobal?: boolean }) => {
		const updated = await api.updatePronunciationRule(ruleId, data);
		setPronunciationRules((prev) => prev.map((rule) => (rule._id === ruleId ? updated : rule)));
		pronunciationRulesRef.current = pronunciationRulesRef.current.map((rule) => (rule._id === ruleId ? updated : rule));
		restartSpeechFromCurrentBlock();
	};

	const handleDeletePronunciationRule = async (ruleId: string) => {
		await api.deletePronunciationRule(ruleId);
		setPronunciationRules((prev) => prev.filter((rule) => rule._id !== ruleId));
		pronunciationRulesRef.current = pronunciationRulesRef.current.filter((rule) => rule._id !== ruleId);
		restartSpeechFromCurrentBlock();
	};

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
					if (reader.theme) setTheme(reader.theme);
					if (reader.fontSize) setFontSize(reader.fontSize);
					if (reader.width) setReadWidth(reader.width);
					if (reader.autoNext !== undefined) setAutoOpenNext(reader.autoNext);
					if (reader.speechRate) {
						setSpeechRate(reader.speechRate);
						speechConfigRef.current.rate = reader.speechRate;
					}
					if (reader.speechPitch) {
						setSpeechPitch(reader.speechPitch);
						speechConfigRef.current.pitch = reader.speechPitch;
					}
					if (reader.voiceURI) {
						setSelectedVoiceURI(reader.voiceURI);
						speechConfigRef.current.voiceURI = reader.voiceURI;
					}
					if (reader.highlightMode) setHighlightMode(reader.highlightMode);
					if (reader.highlightParagraph !== undefined) setHighlightParagraph(reader.highlightParagraph);
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
	}, [user]);

	useEffect(() => {
		if (!speechSupported || typeof window === "undefined" || !("speechSynthesis" in window)) return;

		const updateVoices = () => {
			const voices = window.speechSynthesis.getVoices();
			setAvailableVoices(voices);

			// Automatically pick a default English voice if no preference is saved
			if (!selectedVoiceURI && voices.length > 0) {
				const defaultVoice =
					voices.find((v) => v.voiceURI.includes("Natural") && v.lang.startsWith("en")) ||
					voices.find((v) => v.lang.startsWith("en")) ||
					voices[0];
				if (defaultVoice) {
					setSelectedVoiceURI(defaultVoice.voiceURI);
					speechConfigRef.current.voiceURI = defaultVoice.voiceURI;
				}
			}
		};

		updateVoices();
		window.speechSynthesis.onvoiceschanged = updateVoices;

		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.onvoiceschanged = null;
			}
		};
	}, [speechSupported, selectedVoiceURI]);

	const clearSpeakingHighlights = useCallback(() => {
		if (activeSpeechElementRef.current) {
			activeSpeechElementRef.current.classList.remove("reader-speaking-block");
			activeSpeechElementRef.current = null;
		}
		if (activeWordHighlightRef.current) {
			const parent = activeWordHighlightRef.current.parentNode;
			if (parent) {
				const originalText = parent.textContent || "";
				parent.replaceChild(document.createTextNode(originalText), activeWordHighlightRef.current);
			}
			activeWordHighlightRef.current = null;
		}
	}, []);

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

	const highlightSpeechBlock = useCallback(
		(blockIndex: number) => {
			clearSpeakingHighlights();

			const blocks = getSpeechBlocks();
			const block = blocks[blockIndex];
			if (!block) return;

			if (highlightParagraph) {
				block.element.classList.add("reader-speaking-block");
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
		[getSpeechBlocks, clearSpeakingHighlights, autoScrollDuringSpeech, autoScrollOffset, autoScrollBehavior, highlightParagraph],
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
			span.className = "reader-speaking-word";
			span.textContent = word;
			element.appendChild(span);
			activeWordHighlightRef.current = span;

			if (after) {
				element.appendChild(document.createTextNode(after));
			}
		},
		[getSpeechBlocks, clearSpeakingWord],
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

	// Gracefully shutdown SpeechSynthesis and state timers on teardown
	useEffect(() => {
		return () => {
			if (settingsSaveTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(settingsSaveTimerRef.current);
			}
			if (speechStartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechStartTimerRef.current);
			}
			if (speechRestartTimerRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(speechRestartTimerRef.current);
			}
			stopSpeech();
		};
	}, [stopSpeech]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			window.scrollTo({ top: 0, behavior: "auto" });
		}
	}, [chapterNumber, stopSpeech]);

	useEffect(() => {
		let cancelled = false;

		async function loadChapter() {
			if (!bookId || Number.isNaN(chapterNumber)) return;
			setLoading(true);
			setError("");
			setChapter(null);
			setAdminActionMessage("");

			try {
				const [bookData, chaptersData] = isRawReader
					? await Promise.all([api.getPublicBook(bookId), api.getPublicRawChapters(bookId)])
					: await Promise.all([api.getPublicBook(bookId), api.getPublicChapters(bookId)]);
				if (cancelled) return;
				setBook(bookData);
				setChapters(chaptersData);

				try {
					const chapterData = isRawReader
						? await api.getPublicRawChapter(bookId, chapterNumber)
						: await api.getPublicChapter(bookId, chapterNumber);
					if (cancelled) return;
					setChapter(chapterData);

					if (user && !isRawReader) {
						void api.recordChapterVisit(bookId, chapterData.chapterNumber).catch((visitErr) => {
							console.error("Failed to record chapter revisit:", visitErr);
						});

						if (chapterData.chapterNumber > bookData.chaptersRead) {
							void api.updateBook(bookId, { chaptersRead: chapterData.chapterNumber }).catch((updateErr) => {
								console.error("Failed to update reading progress:", updateErr);
							});
						}
					}
				} catch (chapterErr: unknown) {
					if (cancelled) return;
					setError(getErrorMessage(chapterErr, "This chapter has not been archived yet."));
				}
			} catch (err: unknown) {
				if (cancelled) return;
				console.error("Failed to load chapter content:", err);
				setError(getErrorMessage(err, "Could not load this reader page."));
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadChapter();

		return () => {
			cancelled = true;
		};
	}, [isRawReader, user, bookId, chapterNumber]);

	// Instantly clear blocks on navigation or new contents to prevent stale tracking
	useEffect(() => {
		speechBlocksRef.current = [];
		activeSpeechElementRef.current = null;
		activeWordHighlightRef.current = null;
	}, [chapter?.content, chapterNumber]);

	const catalogItems = useMemo<CatalogChapter[]>(() => {
		if (!book) return [];

		const archivedByNumber = new Map(chapters.map((item) => [item.chapterNumber, item]));
		const seen = new Set<number>();
		const items: CatalogChapter[] = [];

		const indexedChapters = isRawReader ? book.rawChaptersList || [] : book.translatedChaptersList || [];

		for (const indexed of indexedChapters) {
			if (!indexed.chapterNumber || seen.has(indexed.chapterNumber)) continue;
			const archived = archivedByNumber.get(indexed.chapterNumber);
			items.push({
				chapterNumber: indexed.chapterNumber,
				title: resolveChapterTitle(book.title, indexed.chapterNumber, archived?.title, indexed.title),
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || indexed.url,
				scrapedAt: archived?.scrapedAt,
			});
			seen.add(indexed.chapterNumber);
		}

		for (const archived of chapters) {
			if (seen.has(archived.chapterNumber)) continue;
			items.push({
				chapterNumber: archived.chapterNumber,
				title: resolveChapterTitle(book.title, archived.chapterNumber, archived.title),
				archived: true,
				sourceUrl: archived.sourceUrl,
				scrapedAt: archived.scrapedAt,
			});
			seen.add(archived.chapterNumber);
		}

		return items.sort((a, b) => a.chapterNumber - b.chapterNumber);
	}, [isRawReader, book, chapters]);

	const filteredCatalogItems = useMemo(() => {
		const query = catalogSearch.trim().toLowerCase();
		if (!query) return catalogItems;

		return catalogItems.filter((item) => item.title.toLowerCase().includes(query) || item.chapterNumber.toString().includes(query));
	}, [catalogItems, catalogSearch]);

	const currentCatalogIndex = useMemo(() => catalogItems.findIndex((item) => item.chapterNumber === chapterNumber), [catalogItems, chapterNumber]);
	const currentCatalogItem = currentCatalogIndex >= 0 ? catalogItems[currentCatalogIndex] : undefined;
	const readerSourceKind: SourceKind = isRawReader ? "raw" : "translated";
	const archiveJobType: JobType = isRawReader ? "scrape_raw_chapters" : "scrape_chapters";
	const currentSourceUrl = currentCatalogItem?.sourceUrl || chapter?.sourceUrl || "";
	const missingChapterTitle = currentCatalogItem?.title || `${isRawReader ? "Raw chapter" : "Chapter"} ${chapterNumber}`;

	const previousChapterNumber = currentCatalogIndex > 0 ? catalogItems[currentCatalogIndex - 1].chapterNumber : chapterNumber - 1;
	const nextChapterNumber =
		currentCatalogIndex >= 0 && currentCatalogIndex < catalogItems.length - 1 ? catalogItems[currentCatalogIndex + 1].chapterNumber : chapterNumber + 1;
	const hasPreviousChapter = currentCatalogIndex >= 0 ? currentCatalogIndex > 0 : chapterNumber > 1;
	const hasNextChapter =
		currentCatalogIndex >= 0
			? currentCatalogIndex < catalogItems.length - 1
			: Boolean(
					book &&
					!(
						(isRawReader ? book.rawChaptersTotal : book.translatedChaptersTotal) > 0 &&
						chapterNumber >= (isRawReader ? book.rawChaptersTotal : book.translatedChaptersTotal)
					),
				);

	const indexedCurrentTitle = useMemo(() => {
		const indexedChapters = isRawReader ? book?.rawChaptersList : book?.translatedChaptersList;
		return indexedChapters?.find((item) => item.chapterNumber === chapterNumber)?.title;
	}, [isRawReader, book, chapterNumber]);

	const displayChapterTitle = useMemo(() => {
		if (!book || !chapter) return `Chapter ${chapterNumber}`;
		return resolveChapterTitle(book.title, chapter.chapterNumber, chapter.title, indexedCurrentTitle);
	}, [chapter, chapterNumber, indexedCurrentTitle, book]);

	const navigateToChapter = useCallback(
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
			router.push(`/books/${bookId}/reader/${chapterNumber}${query.toString() ? `?${query.toString()}` : ""}`);
		},
		[chapterNumber, bookId, router],
	);

	const handleGenerateTranslation = useCallback(async () => {
		if (!bookId || !chapter) return;
		setTranslatingRawChapter(true);
		setError("");

		try {
			await api.translateRawChapter(bookId, chapter.chapterNumber, { targetLanguage: "English" });
			router.push(`/books/${bookId}/reader/${chapter.chapterNumber}`);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Could not generate translated chapter."));
		} finally {
			setTranslatingRawChapter(false);
		}
	}, [chapter, bookId, router]);

	const reloadCurrentChapter = useCallback(async () => {
		const [chapterData, chaptersData] = isRawReader
			? await Promise.all([api.getPublicRawChapter(bookId, chapterNumber), api.getPublicRawChapters(bookId)])
			: await Promise.all([api.getPublicChapter(bookId, chapterNumber), api.getPublicChapters(bookId)]);

		setChapter(chapterData);
		setChapters(chaptersData);
		setError("");
	}, [chapterNumber, isRawReader, bookId]);

	const handleScrapeCurrentChapterNow = useCallback(async () => {
		if (!book) return;

		setAdminScrapingChapter(true);
		setAdminActionMessage("");
		try {
			const result = await api.runScrapeNow(bookId, archiveJobType, { chapterNumber });
			setBook(result.book);
			await reloadCurrentChapter();
			setAdminActionMessage(result.message || "Chapter archived.");
		} catch (err: unknown) {
			setAdminActionMessage(getErrorMessage(err, "Could not archive this chapter."));
		} finally {
			setAdminScrapingChapter(false);
		}
	}, [archiveJobType, chapterNumber, book, bookId, reloadCurrentChapter]);

	const handleImportCurrentChapterHtml = useCallback(
		async (event: React.FormEvent) => {
			event.preventDefault();
			if (!book) return;

			setImportingChapterHtml(true);
			setAdminActionMessage("");
			try {
				const result = await api.importChapterHtml(bookId, {
					sourceKind: readerSourceKind,
					chapterNumber,
					pageUrl: chapterHtmlPageUrl || currentSourceUrl,
					html: chapterHtmlContent,
				});
				await reloadCurrentChapter();
				setAdminActionMessage(result.message || "Chapter HTML imported.");
				setChapterHtmlContent("");
			} catch (err: unknown) {
				setAdminActionMessage(getErrorMessage(err, "Could not import chapter HTML."));
			} finally {
				setImportingChapterHtml(false);
			}
		},
		[chapterHtmlContent, chapterHtmlPageUrl, chapterNumber, currentSourceUrl, book, bookId, readerSourceKind, reloadCurrentChapter],
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
			hasNextChapter,
			highlightMode,
			highlightSpeechBlock,
			highlightSpeechWord,
			navigateToChapter,
			nextChapterNumber,
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
	}, [authLoading, chapter, chapterNumber, loading, readerSettingsReady, shouldResumeTtsFromRoute, speechSupported, startSpeechFromBlock, buildSpeechBlocks]);

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

		void startSpeechFromBlock(blockIndex, { continueAcrossChapters: autoOpenNext, fromUserGesture: true });
	};

	if (loading) {
		return (
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-primary)" }}>
				<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
					<div className="spinner" style={{ width: "40px", height: "40px" }}></div>
					<span style={{ color: "var(--text-secondary)" }}>Retrieving archived chapter...</span>
				</div>
			</div>
		);
	}

	if (error || !chapter || !book) {
		return (
			<div className="container">
				<div className="glass-card empty-state">
					<h2 style={{ color: "var(--danger)", marginBottom: "1rem" }}>{missingChapterTitle}</h2>
					<p style={{ maxWidth: "520px", color: "var(--text-secondary)", margin: "0 auto 2rem" }}>
						{error || "This chapter has not been archived yet."}
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
								Archive this {isRawReader ? "raw" : "translated"} chapter now, or paste the saved HTML for this source page.
							</p>

							<div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
								<button
									type="button"
									className="btn btn-primary"
									onClick={handleScrapeCurrentChapterNow}
									disabled={adminScrapingChapter || !currentCatalogItem?.sourceUrl}
								>
									{adminScrapingChapter ? "Scraping..." : "Scrape This Chapter Now"}
								</button>
								{currentSourceUrl && (
									<a href={currentSourceUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
										Open Source
									</a>
								)}
							</div>

							<form key={`${readerSourceKind}-${chapterNumber}`} onSubmit={handleImportCurrentChapterHtml} style={{ display: "grid", gap: "1rem" }}>
								<div className="form-group" style={{ marginBottom: 0 }}>
									<label className="form-label">Chapter Page URL</label>
									<input
										type="url"
										className="form-input"
										value={chapterHtmlPageUrl || currentSourceUrl}
										onChange={(event) => setChapterHtmlPageUrl(event.target.value)}
										placeholder="https://example.com/chapter"
										required
									/>
								</div>

								<div className="form-group" style={{ marginBottom: 0 }}>
									<label className="form-label">Saved Chapter HTML</label>
									<textarea
										className="form-textarea"
										rows={10}
										value={chapterHtmlContent}
										onChange={(event) => setChapterHtmlContent(event.target.value)}
										placeholder="<html>..."
										required
									/>
								</div>

								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
									<span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
										{readerSourceKind === "raw" ? "Raw chapter" : "Translated chapter"} {chapterNumber}
									</span>
									<button type="submit" className="btn btn-primary" disabled={importingChapterHtml}>
										{importingChapterHtml ? "Importing..." : "Import HTML"}
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
										{isRawReader ? "Raw" : "Translated"} · {catalogItems.length} chapters indexed, {chapters.length} archived.
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
								placeholder="Search chapter number or title"
							/>

							<div className="reader-catalog-list">
								{filteredCatalogItems.map((item) => (
									<button
										key={item.chapterNumber}
										className={`reader-catalog-item ${item.chapterNumber === chapterNumber ? "active" : ""}`}
										onClick={() => {
											setIsCatalogOpen(false);
											navigateToChapter(item.chapterNumber);
										}}
									>
										<span>Chapter {item.chapterNumber}</span>
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
						<header className="reader-chapter-header">
							<h1>{displayChapterTitle}</h1>
							<div className="reader-chapter-meta max-[860px]:flex-col max-[860px]:items-start">
								<span>{book.title}</span>
								<span>
									{isRawReader ? "Raw" : "Translated"} chapter {chapter.chapterNumber}{" "}
									{(isRawReader ? book.rawChaptersTotal : book.translatedChaptersTotal)
										? `of ${isRawReader ? book.rawChaptersTotal : book.translatedChaptersTotal}`
										: ""}
								</span>
								{chapter.sourceUrl && (
									<a href={chapter.sourceUrl} target="_blank" rel="noreferrer">
										Original Source
									</a>
								)}
							</div>
							{isRawReader && hasCapability(CAPABILITY.CHAPTERS_TRANSLATE) && (
								<div className="mx-auto mt-4 flex w-fit max-w-[min(92vw,640px)] flex-wrap items-center justify-center gap-3 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-[0.45rem] text-[0.78rem] font-bold text-[var(--reader-muted)]">
									<span>Raw source view</span>
									<button className="reader-tool-button" onClick={handleGenerateTranslation} disabled={translatingRawChapter}>
										{translatingRawChapter ? "Generating..." : "Generate English Translation"}
									</button>
								</div>
							)}
						</header>

						<div
							ref={readerContentRef}
							className="reader-content"
							style={readerContentStyle}
							onClick={handleReaderContentClick}
							dangerouslySetInnerHTML={{ __html: chapter.content }}
						/>

						<footer className="reader-footer">
							<button
								className="btn btn-secondary"
								style={{ color: "var(--reader-text)", borderColor: "var(--reader-border)", backgroundColor: "transparent" }}
								disabled={!hasPreviousChapter}
								onClick={() => navigateToChapter(previousChapterNumber)}
							>
								← Previous Chapter
							</button>

							<button className="reader-tool-button" onClick={() => setIsCatalogOpen(true)}>
								Open Catalogue
							</button>

							<button className="btn btn-primary" disabled={!hasNextChapter} onClick={() => navigateToChapter(nextChapterNumber)}>
								Next Chapter →
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
					onPrevChapter={() => navigateToChapter(previousChapterNumber)}
					onNextChapter={() => navigateToChapter(nextChapterNumber)}
					hasPrevChapter={hasPreviousChapter}
					hasNextChapter={hasNextChapter}
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
					onPreviousChapter={() => navigateToChapter(previousChapterNumber)}
					onNextChapter={() => navigateToChapter(nextChapterNumber)}
					onOpenCatalog={() => setIsCatalogOpen(true)}
					hasPreviousChapter={hasPreviousChapter}
					hasNextChapter={hasNextChapter}
					previousChapterNumber={previousChapterNumber}
					nextChapterNumber={nextChapterNumber}
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
					hasRawChapters={book.rawChaptersTotal > 0}
					sourceUrl={chapter.sourceUrl}
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

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return fallback;
}
