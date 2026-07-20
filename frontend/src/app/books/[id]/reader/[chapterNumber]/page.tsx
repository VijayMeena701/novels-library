"use client";

import { cn } from '../../../../../lib/utils';

import { use, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react';
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
import { Button } from "../../../../../components/ui/button";
import { Input, Textarea } from "../../../../../components/ui/input";
import { Spinner } from "../../../../../components/ui/spinner";

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
			const element = activeSpeechElementRef.current;
			element.style.backgroundColor = "";
			element.style.boxShadow = "";
			element.style.borderRadius = "";
			element.style.transition = "";
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
		async (event: FormEvent) => {
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

	const handleReaderContentClick = (event: MouseEvent<HTMLDivElement>) => {
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
			<div className="flex flex-1 items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4">
					<Spinner size="xl" />
					<span className="text-copy">Retrieving archived chapter...</span>
				</div>
			</div>
		);
	}

	if (error || !chapter || !book) {
		return (
			<div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12")}>
				<div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">
					<h2 className="mb-4 text-danger">{missingChapterTitle}</h2>
					<p className="mx-auto mb-8 max-w-[520px] text-copy">
						{error || "This chapter has not been archived yet."}
					</p>
					<div className="flex flex-wrap justify-center gap-4">
						<Button asChild variant="secondary">
							<Link href={`/books/${bookId}`}>Back to Book Index</Link>
						</Button>
						{currentSourceUrl && (
							<Button asChild>
								<a href={currentSourceUrl} target="_blank" rel="noreferrer">Open Source Page</a>
							</Button>
						)}
					</div>

					{hasCapability(CAPABILITY.JOBS_SCRAPE) && book && (
						<div className="mx-auto mt-8 w-[min(820px,100%)] rounded-lg border border-border bg-card p-6 text-left shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
							<h3 className="mb-2 text-[1.15rem]">Admin Recovery</h3>
							<p className="mb-4 text-[0.9rem] text-copy">
								Archive this {isRawReader ? "raw" : "translated"} chapter now, or paste the saved HTML for this source page.
							</p>

							<div className="mb-4 flex flex-wrap gap-3">
								<Button type="button"
									onClick={handleScrapeCurrentChapterNow}
									disabled={adminScrapingChapter || !currentCatalogItem?.sourceUrl}
								>
									{adminScrapingChapter ? "Scraping..." : "Scrape This Chapter Now"}
								</Button>
								{currentSourceUrl && (
								<Button asChild variant="secondary">
									<a href={currentSourceUrl} target="_blank" rel="noreferrer">Open Source</a>
								</Button>
								)}
							</div>

							<form key={`${readerSourceKind}-${chapterNumber}`} onSubmit={handleImportCurrentChapterHtml} className="grid gap-4">
								<div className="flex flex-col gap-2">
									<label className="text-sm font-semibold text-copy">Chapter Page URL</label>
									<Input type="url"
										
										value={chapterHtmlPageUrl || currentSourceUrl}
										onChange={(event) => setChapterHtmlPageUrl(event.target.value)}
										placeholder="https://example.com/chapter"
										required
									/>
								</div>

								<div className="flex flex-col gap-2">
									<label className="text-sm font-semibold text-copy">Saved Chapter HTML</label>
									<Textarea rows={10}
										value={chapterHtmlContent}
										onChange={(event) => setChapterHtmlContent(event.target.value)}
										placeholder="<html>..."
										required
									/>
								</div>

								<div className="flex flex-wrap items-center justify-between gap-4">
									<span className="text-[0.85rem] text-copy">
										{readerSourceKind === "raw" ? "Raw chapter" : "Translated chapter"} {chapterNumber}
									</span>
									<Button type="submit" disabled={importingChapterHtml}>
										{importingChapterHtml ? "Importing..." : "Import HTML"}
									</Button>
								</div>
							</form>

							{adminActionMessage && (
								<p className="mt-4 text-[0.9rem] text-copy">{adminActionMessage}</p>
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
	} as CSSProperties;

	type ReaderThemeStyle = CSSProperties & { [key: string]: string };

	const readerThemeStyle: Record<ReaderTheme, ReaderThemeStyle> = {
		dark: {
			"--reader-bg": "#10131a",
			"--reader-text": "#ece7dc",
			"--reader-border": "#2f3440",
			"--reader-surface": "#181d27",
			"--reader-surface-hover": "#222938",
			"--reader-muted": "#a59c8d",
			"--reader-accent": "#d08a48",
		},
		light: {
			"--reader-bg": "#fffdf8",
			"--reader-text": "#24211d",
			"--reader-border": "#dfd6c8",
			"--reader-surface": "#fffaf1",
			"--reader-surface-hover": "#f2ecdf",
			"--reader-muted": "#756d62",
			"--reader-accent": "#405f8f",
		},
		sepia: {
			"--reader-bg": "#f7f0df",
			"--reader-text": "#5c4d3b",
			"--reader-border": "#e4dac6",
			"--reader-surface": "#fff8e8",
			"--reader-surface-hover": "#efe5d0",
			"--reader-muted": "#8b7b65",
			"--reader-accent": "#9b5b36",
		},
	};

	return (
		<>
			<div className={cn("flex min-h-screen flex-col", theme === "light" ? "font-sans" : "font-serif")} style={readerThemeStyle[theme]}>
				<div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--reader-border)] bg-[var(--reader-bg)]/90 px-5 py-2.5 backdrop-blur-[10px] max-[860px]:gap-2 max-[860px]:px-3 max-[860px]:py-[0.65rem]">
					<div className="flex w-full flex-wrap items-center justify-between gap-2">
						<button className="min-h-8 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setIsCatalogOpen(true)}>
							Catalogue
						</button>
						<Link href={`/books/${bookId}`} className="text-[0.88rem] font-extrabold text-[var(--reader-text)] no-underline">
							← {book.title.length > 24 ? `${book.title.substring(0, 24)}...` : book.title}
						</Link>
						<div className="flex flex-wrap items-center justify-end gap-2">
							<button className="min-h-8 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={handlePlaySpeech}>
								Listen
							</button>
							<button className="min-h-8 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
					<div className="fixed inset-0 z-[1000] flex items-start justify-start bg-black/50" onClick={() => setIsCatalogOpen(false)}>
						<aside className="flex min-h-screen w-full max-w-[420px] flex-col gap-4 border-r border-[var(--reader-border)] bg-[var(--reader-bg)] p-5 shadow-lg" onClick={(event) => event.stopPropagation()}>
							<div className="flex items-start justify-between gap-4">
								<div>
									<h2>Catalogue</h2>
									<p>
										{isRawReader ? "Raw" : "Translated"} · {catalogItems.length} chapters indexed, {chapters.length} archived.
									</p>
								</div>
								<button className="min-h-8 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setIsCatalogOpen(false)}>
									Close
								</button>
							</div>

							<Input className="min-h-10 w-full rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 text-sm text-[var(--reader-text)] outline-none focus:border-[var(--reader-accent)]"
								value={catalogSearch}
								onChange={(event) => setCatalogSearch(event.target.value)}
								placeholder="Search chapter number or title"
							/>

							<div className="flex flex-1 flex-col gap-2 overflow-auto pr-1">
								{filteredCatalogItems.map((item) => (
									<button key={item.chapterNumber}
										className={cn("w-full rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] p-3 text-left text-sm text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)]", item.chapterNumber === chapterNumber && "border-[var(--reader-accent)] bg-[var(--reader-surface-hover)]")}
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

				<main className="flex justify-center px-5 py-12 max-[860px]:px-3 max-[860px]:py-5">
					<article className="flex w-full flex-col gap-6 leading-[1.8] text-[var(--reader-text)]" style={{ maxWidth: widthStyle }}>
						<header className="border-b border-[var(--reader-border)] pb-6">
							<h1>{displayChapterTitle}</h1>
							<div className="mt-2 flex flex-wrap items-center justify-between gap-4 text-[0.82rem] text-[var(--reader-muted)] max-[860px]:flex-col max-[860px]:items-start">
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
									<button className="min-h-8 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={handleGenerateTranslation} disabled={translatingRawChapter}>
										{translatingRawChapter ? "Generating..." : "Generate English Translation"}
									</button>
								</div>
							)}
						</header>

						<div ref={readerContentRef}
							className="text-[var(--reader-text)] [line-break:anywhere] [&_p]:mt-0 [&_p]:mb-[1.2em] [&_p]:cursor-pointer [&_li]:cursor-pointer [&_blockquote]:cursor-pointer [&_h1]:cursor-pointer [&_h2]:cursor-pointer [&_h3]:cursor-pointer [&_h4]:cursor-pointer [&_p]:scroll-mt-28 [&_li]:scroll-mt-28 [&_blockquote]:scroll-mt-28 [&_h1]:scroll-mt-28 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28 [&_h4]:scroll-mt-28 [&_p]:rounded-sm [&_li]:rounded-sm [&_blockquote]:rounded-sm [&_h1]:rounded-sm [&_h2]:rounded-sm [&_h3]:rounded-sm [&_h4]:rounded-sm [&_p]:transition-[background-color,box-shadow] [&_li]:transition-[background-color,box-shadow] [&_blockquote]:transition-[background-color,box-shadow] [&_h1]:transition-[background-color,box-shadow] [&_h2]:transition-[background-color,box-shadow] [&_h3]:transition-[background-color,box-shadow] [&_h4]:transition-[background-color,box-shadow] [&_p]:duration-[160ms] [&_li]:duration-[160ms] [&_blockquote]:duration-[160ms] [&_h1]:duration-[160ms] [&_h2]:duration-[160ms] [&_h3]:duration-[160ms] [&_h4]:duration-[160ms] [&_p]:ease-[ease] [&_li]:ease-[ease] [&_blockquote]:ease-[ease] [&_h1]:ease-[ease] [&_h2]:ease-[ease] [&_h3]:ease-[ease] [&_h4]:ease-[ease] [&_p:hover]:bg-[color-mix(in_srgb,var(--reader-accent)_9%,transparent)] [&_li:hover]:bg-[color-mix(in_srgb,var(--reader-accent)_9%,transparent)] [&_blockquote:hover]:bg-[color-mix(in_srgb,var(--reader-accent)_9%,transparent)] [&_img]:max-w-full [&_img]:h-auto"
							style={readerContentStyle}
							onClick={handleReaderContentClick}
							dangerouslySetInnerHTML={{ __html: chapter.content }}
						/>

						<footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--reader-border)] pt-6">
							<Button
								variant="secondary"
								className="border-[var(--reader-border)] bg-transparent text-[var(--reader-text)]"
								disabled={!hasPreviousChapter}
								onClick={() => navigateToChapter(previousChapterNumber)}
							>
								← Previous Chapter
							</Button>

							<button className="min-h-8 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setIsCatalogOpen(true)}>
								Open Catalogue
							</button>

							<Button disabled={!hasNextChapter} onClick={() => navigateToChapter(nextChapterNumber)}>
								Next Chapter →
							</Button>
						</footer>
					</article>
				</main>

				<SpeechWidget supported={speechSupported}
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

				<ReaderBottomToolbar isOpen={isReaderPanelOpen}
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

				<PronunciationRulesModal open={isPronunciationModalOpen}
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
