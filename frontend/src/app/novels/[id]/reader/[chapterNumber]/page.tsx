"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	api,
	type Novel,
	type ChapterContent,
	type JobType,
	type ReaderSettings,
	type ReaderTheme,
	type ReaderWidth,
	type SourceKind,
} from "../../../../../utils/api";
import { useAuth } from "../../../../../context/AuthContext";

type TtsStatus = "idle" | "playing" | "paused";
type ReaderPanelTab = "read" | "display" | "speech" | "settings" | "more";
type ReaderSource = "translated" | "raw";

const SPEECH_RATE_MIN = 0.5;
const SPEECH_RATE_MAX = 4;
const SPEECH_PITCH_MIN = 0.5;
const SPEECH_PITCH_MAX = 2;
const SPEECH_BLOCK_SELECTOR = "p, li, blockquote, h1, h2, h3, h4, div";
const SPEECH_RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const SPEECH_PITCH_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface CatalogChapter {
	number: number;
	title: string;
	archived: boolean;
	sourceUrl?: string;
	scrapedAt?: string;
}

interface SpeechQueueItem {
	text: string;
	blockIndex: number;
}

interface SpeechBlock {
	element: HTMLElement;
	text: string;
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

function isGenericChapterTitle(value: string, novelTitle: string, chapterNumber: number): boolean {
	const normalized = normalizeTitle(value);
	return !normalized || normalized === normalizeTitle(novelTitle) || normalized === `chapter ${chapterNumber}` || normalized === `ch ${chapterNumber}`;
}

function resolveChapterTitle(novelTitle: string, chapterNumber: number, archivedTitle?: string, indexedTitle?: string): string {
	const archived = archivedTitle?.trim() || "";
	const indexed = indexedTitle?.trim() || "";

	if (indexed && isGenericChapterTitle(archived, novelTitle, chapterNumber)) {
		return indexed;
	}

	return archived || indexed || `Chapter ${chapterNumber}`;
}

function splitSpeechText(text: string, maxLength = 1800): string[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return [];

	const chunks: string[] = [];
	let remaining = normalized;

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

		chunks.push(remaining.slice(0, breakAt).trim());
		remaining = remaining.slice(breakAt).trim();
	}

	if (remaining) {
		chunks.push(remaining);
	}

	return chunks;
}

function formatSpeechValue(value: number): string {
	return value.toFixed(2).replace(/\.?0+$/, "");
}

export default function ReaderView({ params }: { params: Promise<{ id: string; chapterNumber: string }> }) {
	const { id: novelId, chapterNumber: chNumStr } = use(params);
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading: authLoading } = useAuth();

	const chapterNumber = parseInt(chNumStr, 10);
	const shouldResumeTtsFromRoute = searchParams.get("tts") === "1";
	const readingSource: ReaderSource = searchParams.get("source") === "raw" ? "raw" : "translated";
	const isRawReader = readingSource === "raw";

	const [novel, setNovel] = useState<Novel | null>(null);
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
	const [autoOpenNext, setAutoOpenNext] = useState(false);
	const [isCatalogOpen, setIsCatalogOpen] = useState(false);
	const [isReaderPanelOpen, setIsReaderPanelOpen] = useState(false);
	const [isSpeechPortalOpen, setIsSpeechPortalOpen] = useState(false);
	const [readerSettingsReady, setReaderSettingsReady] = useState(false);
	const [readerPanelTab, setReaderPanelTab] = useState<ReaderPanelTab>("read");
	const [catalogSearch, setCatalogSearch] = useState("");

	const [speechSupported, setSpeechSupported] = useState(false);
	const [ttsStatus, setTtsStatus] = useState<TtsStatus>("idle");
	const [speechRate, setSpeechRate] = useState(1);
	const [speechPitch, setSpeechPitch] = useState(1);
	const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
	const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
	const [speechError, setSpeechError] = useState("");
	const [speechPortalPosition, setSpeechPortalPosition] = useState({ x: 24, y: 120 });
	const [isCompactLayout, setIsCompactLayout] = useState(false);

	const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const speechStartTimerRef = useRef<number | null>(null);
	const speechQueueRef = useRef<SpeechQueueItem[]>([]);
	const speechBlocksRef = useRef<SpeechBlock[]>([]);
	const activeSpeechElementRef = useRef<HTMLElement | null>(null);
	const speechIndexRef = useRef(0);
	const activeSpeechBlockIndexRef = useRef<number | null>(null);
	const ttsStatusRef = useRef<TtsStatus>("idle");
	const speechConfigRef = useRef({
		rate: 1,
		pitch: 1,
		voiceURI: "",
	});
	const speechRestartTimerRef = useRef<number | null>(null);
	const shouldContinueSpeechRef = useRef(false);
	const startedAutoSpeechForChapterRef = useRef<number | null>(null);
	const readerContentRef = useRef<HTMLDivElement | null>(null);
	const pendingReaderSettingsRef = useRef<Partial<ReaderSettings>>({});
	const settingsSaveTimerRef = useRef<number | null>(null);
	const portalDragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		originX: number;
		originY: number;
		currentX: number;
		currentY: number;
	} | null>(null);
	const speechPortalRef = useRef<HTMLDivElement | null>(null);
	const portalRafRef = useRef<number | null>(null);

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

		if (!user) {
			setReaderSettingsReady(true);
			return;
		}

		let cancelled = false;
		setReaderSettingsReady(false);

		async function loadSettings() {
			try {
				const settings = await api.getSettings();
				if (cancelled) return;
				const nextSpeechRate = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, settings.reader.speechRate));
				const nextSpeechPitch = Math.min(SPEECH_PITCH_MAX, Math.max(SPEECH_PITCH_MIN, settings.reader.speechPitch));

				setTheme(settings.reader.theme);
				setFontSize(Math.min(32, Math.max(12, settings.reader.fontSize)));
				setReadWidth(settings.reader.width);
				setAutoOpenNext(settings.reader.autoNext);
				setSpeechRate(nextSpeechRate);
				setSpeechPitch(nextSpeechPitch);
				setSelectedVoiceURI(settings.reader.voiceURI);
				speechConfigRef.current = {
					rate: nextSpeechRate,
					pitch: nextSpeechPitch,
					voiceURI: settings.reader.voiceURI,
				};
				setSpeechPortalPosition({
					x: Math.max(8, settings.reader.speechPortalPosition?.x ?? 24),
					y: Math.max(8, settings.reader.speechPortalPosition?.y ?? 120),
				});
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

		const supportsSpeech = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
		setSpeechSupported(supportsSpeech);

		if (supportsSpeech) {
			const loadVoices = () => {
				setAvailableVoices(window.speechSynthesis.getVoices());
			};

			loadVoices();
			window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
			return () => window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mediaQuery = window.matchMedia("(max-width: 860px)");
		const applyLayout = () => setIsCompactLayout(mediaQuery.matches);
		applyLayout();
		mediaQuery.addEventListener?.("change", applyLayout);

		return () => {
			mediaQuery.removeEventListener?.("change", applyLayout);
		};
	}, []);

	const buildSpeechBlocks = useCallback((): SpeechBlock[] => {
		const root = readerContentRef.current;
		if (!root) return [];

		return Array.from(root.querySelectorAll<HTMLElement>(SPEECH_BLOCK_SELECTOR))
			.filter((element) => isSpeechLeafBlock(element))
			.map((element) => ({
				element,
				text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim(),
			}))
			.filter((block) => block.text.length > 0);
	}, []);

	const getSpeechBlocks = useCallback((): SpeechBlock[] => {
		if (speechBlocksRef.current.length > 0) {
			return speechBlocksRef.current;
		}

		const blocks = buildSpeechBlocks();
		speechBlocksRef.current = blocks;
		return blocks;
	}, [buildSpeechBlocks]);

	const clearSpeakingBlock = useCallback(() => {
		if (activeSpeechElementRef.current) {
			activeSpeechElementRef.current.classList.remove("reader-speaking-block");
			activeSpeechElementRef.current = null;
			return;
		}

		const root = readerContentRef.current;
		root?.querySelectorAll(".reader-speaking-block").forEach((element) => {
			element.classList.remove("reader-speaking-block");
		});
	}, []);

	const highlightSpeechBlock = useCallback(
		(blockIndex: number) => {
			const blocks = getSpeechBlocks();
			const block = blocks[blockIndex];
			if (!block) return;

			clearSpeakingBlock();
			activeSpeechBlockIndexRef.current = blockIndex;
			block.element.classList.add("reader-speaking-block");
			activeSpeechElementRef.current = block.element;

			const rect = block.element.getBoundingClientRect();
			const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
			const topSafe = 120;
			const bottomSafe = 72;
			const isOutOfView = rect.top < topSafe || rect.bottom > viewportHeight - bottomSafe;
			if (isOutOfView) {
				const targetTop = Math.max(0, window.scrollY + rect.top - topSafe);
				window.scrollTo({ top: targetTop, behavior: "smooth" });
			}
		},
		[clearSpeakingBlock, getSpeechBlocks],
	);

	const createSpeechQueueFromBlock = useCallback(
		(startBlockIndex: number): SpeechQueueItem[] => {
			const blocks = getSpeechBlocks();
			const safeStartIndex = Math.min(Math.max(0, startBlockIndex), Math.max(0, blocks.length - 1));
			const queue: SpeechQueueItem[] = [];

			for (let blockIndex = safeStartIndex; blockIndex < blocks.length; blockIndex += 1) {
				for (const text of splitSpeechText(blocks[blockIndex].text)) {
					queue.push({ text, blockIndex });
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
				activeUtteranceRef.current = null;
				window.speechSynthesis.cancel();
			}
			speechQueueRef.current = [];
			speechIndexRef.current = 0;
			activeSpeechBlockIndexRef.current = null;
			clearSpeakingBlock();
			ttsStatusRef.current = "idle";
			setTtsStatus("idle");
		},
		[clearSpeakingBlock],
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
	}, [chapterNumber, stopSpeech]);

	useEffect(() => {
		let cancelled = false;

		async function loadChapter() {
			if (!novelId || Number.isNaN(chapterNumber)) return;
			setLoading(true);
			setError("");
			setChapter(null);
			setAdminActionMessage("");

			try {
				const [novelData, chaptersData] = isRawReader
					? await Promise.all([api.getPublicNovel(novelId), api.getPublicRawChapters(novelId)])
					: await Promise.all([api.getPublicNovel(novelId), api.getPublicChapters(novelId)]);
				if (cancelled) return;
				setNovel(novelData);
				setChapters(chaptersData);

				try {
					const chapterData = isRawReader
						? await api.getPublicRawChapter(novelId, chapterNumber)
						: await api.getPublicChapter(novelId, chapterNumber);
					if (cancelled) return;
					setChapter(chapterData);

					if (user && !isRawReader) {
						void api.recordChapterVisit(novelId, chapterData.chapterNumber).catch((visitErr) => {
							console.error("Failed to record chapter revisit:", visitErr);
						});

						if (chapterData.chapterNumber > novelData.chaptersRead) {
							void api.updateNovel(novelId, { chaptersRead: chapterData.chapterNumber }).catch((updateErr) => {
								console.error("Failed to update reading progress:", updateErr);
							});
						}
					}
				} catch (chapterErr: any) {
					if (cancelled) return;
					setError(chapterErr.message || "This chapter has not been archived yet.");
				}
			} catch (err: any) {
				if (cancelled) return;
				console.error("Failed to load chapter content:", err);
				setError(err.message || "Could not load this reader page.");
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadChapter();

		return () => {
			cancelled = true;
		};
	}, [isRawReader, user, novelId, chapterNumber]);

	useEffect(() => {
		if (!chapter) {
			speechBlocksRef.current = [];
			return;
		}

		speechBlocksRef.current = buildSpeechBlocks();
	}, [buildSpeechBlocks, chapter?.content, chapterNumber]);

	const catalogItems = useMemo<CatalogChapter[]>(() => {
		if (!novel) return [];

		const archivedByNumber = new Map(chapters.map((item) => [item.chapterNumber, item]));
		const seen = new Set<number>();
		const items: CatalogChapter[] = [];

		const indexedChapters = isRawReader ? novel.rawChaptersList || [] : novel.chaptersList || [];

		for (const indexed of indexedChapters) {
			if (!indexed.number || seen.has(indexed.number)) continue;
			const archived = archivedByNumber.get(indexed.number);
			items.push({
				number: indexed.number,
				title: resolveChapterTitle(novel.title, indexed.number, archived?.title, indexed.title),
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || indexed.url,
				scrapedAt: archived?.scrapedAt,
			});
			seen.add(indexed.number);
		}

		for (const archived of chapters) {
			if (seen.has(archived.chapterNumber)) continue;
			items.push({
				number: archived.chapterNumber,
				title: resolveChapterTitle(novel.title, archived.chapterNumber, archived.title),
				archived: true,
				sourceUrl: archived.sourceUrl,
				scrapedAt: archived.scrapedAt,
			});
			seen.add(archived.chapterNumber);
		}

		return items.sort((a, b) => a.number - b.number);
	}, [isRawReader, novel, chapters]);

	const filteredCatalogItems = useMemo(() => {
		const query = catalogSearch.trim().toLowerCase();
		if (!query) return catalogItems;

		return catalogItems.filter((item) => item.title.toLowerCase().includes(query) || item.number.toString().includes(query));
	}, [catalogItems, catalogSearch]);

	const currentCatalogIndex = useMemo(() => catalogItems.findIndex((item) => item.number === chapterNumber), [catalogItems, chapterNumber]);
	const currentCatalogItem = currentCatalogIndex >= 0 ? catalogItems[currentCatalogIndex] : undefined;
	const readerSourceKind: SourceKind = isRawReader ? "raw" : "translated";
	const archiveJobType: JobType = isRawReader ? "scrape_raw_chapters" : "scrape_chapters";
	const currentSourceUrl = currentCatalogItem?.sourceUrl || chapter?.sourceUrl || "";
	const missingChapterTitle = currentCatalogItem?.title || `${isRawReader ? "Raw chapter" : "Chapter"} ${chapterNumber}`;

	useEffect(() => {
		setChapterHtmlPageUrl(currentSourceUrl);
		setChapterHtmlContent("");
	}, [chapterNumber, currentSourceUrl, readingSource]);

	const previousChapterNumber = currentCatalogIndex > 0 ? catalogItems[currentCatalogIndex - 1].number : chapterNumber - 1;
	const nextChapterNumber =
		currentCatalogIndex >= 0 && currentCatalogIndex < catalogItems.length - 1 ? catalogItems[currentCatalogIndex + 1].number : chapterNumber + 1;
	const hasPreviousChapter = currentCatalogIndex >= 0 ? currentCatalogIndex > 0 : chapterNumber > 1;
	const hasNextChapter =
		currentCatalogIndex >= 0
			? currentCatalogIndex < catalogItems.length - 1
			: Boolean(
					novel &&
					!(
						(isRawReader ? novel.rawChaptersTotal : novel.chaptersTotal) > 0 &&
						chapterNumber >= (isRawReader ? novel.rawChaptersTotal : novel.chaptersTotal)
					),
				);

	const indexedCurrentTitle = useMemo(() => {
		const indexedChapters = isRawReader ? novel?.rawChaptersList : novel?.chaptersList;
		return indexedChapters?.find((item) => item.number === chapterNumber)?.title;
	}, [isRawReader, novel, chapterNumber]);

	const displayChapterTitle = useMemo(() => {
		if (!novel || !chapter) return `Chapter ${chapterNumber}`;
		return resolveChapterTitle(novel.title, chapter.chapterNumber, chapter.title, indexedCurrentTitle);
	}, [chapter, chapterNumber, indexedCurrentTitle, novel]);

	const navigateToChapter = useCallback(
		(nextChNum: number, options?: { resumeTts?: boolean }) => {
			const query = new URLSearchParams();
			if (readingSource === "raw") query.set("source", "raw");
			if (options?.resumeTts) query.set("tts", "1");
			const queryString = query.toString();
			router.push(`/novels/${novelId}/reader/${nextChNum}${queryString ? `?${queryString}` : ""}`);
		},
		[novelId, readingSource, router],
	);

	const switchReaderSource = useCallback(
		(source: ReaderSource) => {
			const query = new URLSearchParams();
			if (source === "raw") query.set("source", "raw");
			router.push(`/novels/${novelId}/reader/${chapterNumber}${query.toString() ? `?${query.toString()}` : ""}`);
		},
		[chapterNumber, novelId, router],
	);

	const handleGenerateTranslation = useCallback(async () => {
		if (!novelId || !chapter) return;
		setTranslatingRawChapter(true);
		setError("");

		try {
			await api.translateRawChapter(novelId, chapter.chapterNumber, { targetLanguage: "English" });
			router.push(`/novels/${novelId}/reader/${chapter.chapterNumber}`);
		} catch (err: any) {
			setError(err.message || "Could not generate translated chapter.");
		} finally {
			setTranslatingRawChapter(false);
		}
	}, [chapter, novelId, router]);

	const reloadCurrentChapter = useCallback(async () => {
		const [chapterData, chaptersData] = isRawReader
			? await Promise.all([api.getPublicRawChapter(novelId, chapterNumber), api.getPublicRawChapters(novelId)])
			: await Promise.all([api.getPublicChapter(novelId, chapterNumber), api.getPublicChapters(novelId)]);

		setChapter(chapterData);
		setChapters(chaptersData);
		setError("");
	}, [chapterNumber, isRawReader, novelId]);

	const handleScrapeCurrentChapterNow = useCallback(async () => {
		if (!novel) return;

		setAdminScrapingChapter(true);
		setAdminActionMessage("");
		try {
			const result = await api.runScrapeNow(novelId, archiveJobType, { chapterNumber });
			setNovel(result.novel);
			await reloadCurrentChapter();
			setAdminActionMessage(result.message || "Chapter archived.");
		} catch (err: any) {
			setAdminActionMessage(err.message || "Could not archive this chapter.");
		} finally {
			setAdminScrapingChapter(false);
		}
	}, [archiveJobType, chapterNumber, novel, novelId, reloadCurrentChapter]);

	const handleImportCurrentChapterHtml = useCallback(
		async (event: React.FormEvent) => {
			event.preventDefault();
			if (!novel) return;

			setImportingChapterHtml(true);
			setAdminActionMessage("");
			try {
				const result = await api.importChapterHtml(novelId, {
					sourceKind: readerSourceKind,
					chapterNumber,
					pageUrl: chapterHtmlPageUrl || currentSourceUrl,
					html: chapterHtmlContent,
				});
				await reloadCurrentChapter();
				setAdminActionMessage(result.message || "Chapter HTML imported.");
				setChapterHtmlContent("");
			} catch (err: any) {
				setAdminActionMessage(err.message || "Could not import chapter HTML.");
			} finally {
				setImportingChapterHtml(false);
			}
		},
		[chapterHtmlContent, chapterHtmlPageUrl, chapterNumber, currentSourceUrl, novel, novelId, readerSourceKind, reloadCurrentChapter],
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
				clearSpeakingBlock();
				ttsStatusRef.current = "idle";
				setTtsStatus("idle");
				if (shouldContinueSpeechRef.current && hasNextChapter) {
					navigateToChapter(nextChapterNumber, { resumeTts: true });
				} else {
					shouldContinueSpeechRef.current = false;
				}
				return;
			}

			if (activeSpeechBlockIndexRef.current !== speechItem.blockIndex) {
				highlightSpeechBlock(speechItem.blockIndex);
			}

			const utterance = new SpeechSynthesisUtterance(speechItem.text);
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
				speechIndexRef.current = index + 1;
				speakQueuedChunk(index + 1);
			};
			utterance.onerror = (event) => {
				if (activeUtteranceRef.current !== utterance) return;
				console.error("Speech synthesis error:", event.error);
				setSpeechError("Text to speech stopped in the browser.");
				activeUtteranceRef.current = null;
				clearSpeakingBlock();
				ttsStatusRef.current = "idle";
				setTtsStatus("idle");
			};

			activeUtteranceRef.current = utterance;
			ttsStatusRef.current = "playing";
			setTtsStatus("playing");
			window.speechSynthesis.speak(utterance);
		},
		[availableVoices, clearSpeakingBlock, hasNextChapter, highlightSpeechBlock, navigateToChapter, nextChapterNumber],
	);

	const startSpeechFromBlock = useCallback(
		(startBlockIndex: number, options?: { continueAcrossChapters?: boolean }): boolean => {
			if (!speechSupported || typeof window === "undefined" || !("speechSynthesis" in window)) {
				setSpeechError("Text to speech is not available in this browser.");
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
			setSpeechError("");
			setIsSpeechPortalOpen(true);
			speechStartTimerRef.current = window.setTimeout(() => {
				speechStartTimerRef.current = null;
				speakQueuedChunk(0);
			}, 40);
			return true;
		},
		[createSpeechQueueFromBlock, speakQueuedChunk, speechSupported],
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

		void startSpeechFromBlock(0, { continueAcrossChapters: autoOpenNext });
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

		shouldContinueSpeechRef.current = true;
		const timer = window.setTimeout(() => {
			const didStart = startSpeechFromBlock(0, { continueAcrossChapters: true });
			if (didStart) {
				startedAutoSpeechForChapterRef.current = chapterNumber;
			}
		}, 180);

		return () => window.clearTimeout(timer);
	}, [authLoading, chapter, chapterNumber, loading, readerSettingsReady, shouldResumeTtsFromRoute, speechSupported, startSpeechFromBlock]);

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

	const handlePortalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompactLayout) return;

		portalDragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: speechPortalPosition.x,
			originY: speechPortalPosition.y,
			currentX: speechPortalPosition.x,
			currentY: speechPortalPosition.y,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePortalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompactLayout) return;

		const drag = portalDragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		drag.currentX = Math.max(8, drag.originX + event.clientX - drag.startX);
		drag.currentY = Math.max(8, drag.originY + event.clientY - drag.startY);

		if (portalRafRef.current !== null) return;

		portalRafRef.current = window.requestAnimationFrame(() => {
			portalRafRef.current = null;
			if (!portalDragRef.current || !speechPortalRef.current) return;
			const offsetX = portalDragRef.current.currentX - portalDragRef.current.originX;
			const offsetY = portalDragRef.current.currentY - portalDragRef.current.originY;
			speechPortalRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
		});
	};

	const clearPortalDragState = useCallback(() => {
		if (portalRafRef.current !== null) {
			window.cancelAnimationFrame(portalRafRef.current);
			portalRafRef.current = null;
		}
		if (speechPortalRef.current) {
			speechPortalRef.current.style.transform = "";
		}
	}, []);

	const handleCloseSpeechPortal = useCallback(() => {
		clearPortalDragState();
		portalDragRef.current = null;
		setIsSpeechPortalOpen(false);
	}, [clearPortalDragState]);

	const handlePortalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompactLayout) return;

		const drag = portalDragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		const finalPosition = { x: drag.currentX, y: drag.currentY };
		clearPortalDragState();
		setSpeechPortalPosition(finalPosition);
		portalDragRef.current = null;
		persistReaderSettings({ speechPortalPosition: finalPosition }, { immediate: true });
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	const handlePortalPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompactLayout) return;

		const drag = portalDragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		clearPortalDragState();
		portalDragRef.current = null;
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	useEffect(() => {
		return () => {
			if (portalRafRef.current !== null) {
				window.cancelAnimationFrame(portalRafRef.current);
			}
		};
	}, []);

	const handleReaderContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const root = readerContentRef.current;
		const target = event.target as HTMLElement | null;
		if (!root || !target) return;

		const block = target.closest(SPEECH_BLOCK_SELECTOR) as HTMLElement | null;
		if (!block || !root.contains(block)) return;
		if (!isSpeechLeafBlock(block)) return;

		const blocks = Array.from(root.querySelectorAll<HTMLElement>(SPEECH_BLOCK_SELECTOR)).filter(
			(element) => isSpeechLeafBlock(element) && (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().length > 0,
		);
		const blockIndex = blocks.indexOf(block);
		if (blockIndex < 0) return;

		void startSpeechFromBlock(blockIndex, { continueAcrossChapters: autoOpenNext });
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

	if (error || !chapter || !novel) {
		return (
			<div className="container">
				<div className="glass-card empty-state">
					<h2 style={{ color: "var(--danger)", marginBottom: "1rem" }}>{missingChapterTitle}</h2>
					<p style={{ maxWidth: "520px", color: "var(--text-secondary)", margin: "0 auto 2rem" }}>
						{error || "This chapter has not been archived yet."}
					</p>
					<div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
						<Link href={`/novels/${novelId}`} className="btn btn-secondary">
							Back to Book Index
						</Link>
						{currentSourceUrl && (
							<a href={currentSourceUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
								Open Source Page
							</a>
						)}
					</div>

					{user?.role === "admin" && novel && (
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

							<form onSubmit={handleImportCurrentChapterHtml} style={{ display: "grid", gap: "1rem" }}>
								<div className="form-group" style={{ marginBottom: 0 }}>
									<label className="form-label">Chapter Page URL</label>
									<input
										type="url"
										className="form-input"
										value={chapterHtmlPageUrl}
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
	const themeClass = `reader-theme-${theme}`;
	const hasSpeechRatePreset = SPEECH_RATE_PRESETS.some((preset) => Math.abs(preset - speechRate) < 0.001);
	const hasSpeechPitchPreset = SPEECH_PITCH_PRESETS.some((preset) => Math.abs(preset - speechPitch) < 0.001);

	return (
		<div className={`${themeClass} reader-shell`}>
			<div className="reader-toolbar max-[860px]:gap-2 max-[860px]:px-3 max-[860px]:py-[0.65rem]">
				<div className="reader-toolbar-primary w-full flex-wrap justify-between">
					<button className="reader-tool-button" onClick={() => setIsCatalogOpen(true)}>
						Catalogue
					</button>
					<Link href={`/novels/${novelId}`} className="reader-back-link">
						← {novel.title.length > 24 ? `${novel.title.substring(0, 24)}...` : novel.title}
					</Link>
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

			{speechError && <div className="reader-status-line max-[860px]:max-w-[calc(100vw-16px)]">{speechError}</div>}

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
									key={item.number}
									className={`reader-catalog-item ${item.number === chapterNumber ? "active" : ""}`}
									onClick={() => {
										setIsCatalogOpen(false);
										navigateToChapter(item.number);
									}}
								>
									<span>Chapter {item.number}</span>
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
							<span>{novel.title}</span>
							<span>
								{isRawReader ? "Raw" : "Translated"} chapter {chapter.chapterNumber}{" "}
								{(isRawReader ? novel.rawChaptersTotal : novel.chaptersTotal)
									? `of ${isRawReader ? novel.rawChaptersTotal : novel.chaptersTotal}`
									: ""}
							</span>
							{chapter.sourceUrl && (
								<a href={chapter.sourceUrl} target="_blank" rel="noreferrer">
									Original Source
								</a>
							)}
						</div>
						{isRawReader && user?.role === "admin" && (
							<div className="reader-status-line" style={{ marginTop: "1rem" }}>
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
						style={{ fontSize: `${fontSize}px` }}
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

			{isSpeechPortalOpen && (
				<div
					ref={speechPortalRef}
					className="reader-speech-portal max-[860px]:bottom-[74px] max-[860px]:left-2 max-[860px]:right-2 max-[860px]:top-auto max-[860px]:w-auto max-[860px]:max-h-[calc(100vh-140px)] max-[860px]:overflow-auto"
					style={isCompactLayout ? undefined : { left: speechPortalPosition.x, top: speechPortalPosition.y }}
				>
					<div
						className="reader-speech-portal-header max-[860px]:cursor-default max-[860px]:active:cursor-default"
						onPointerDown={handlePortalPointerDown}
						onPointerMove={handlePortalPointerMove}
						onPointerUp={handlePortalPointerUp}
						onPointerCancel={handlePortalPointerCancel}
						onLostPointerCapture={handlePortalPointerCancel}
					>
						<span className={`reader-speech-status-dot ${ttsStatus}`}></span>
						<strong>{ttsStatus === "idle" ? "Ready" : ttsStatus === "paused" ? "Paused" : "Reading"}</strong>
						<button
							type="button"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								handleCloseSpeechPortal();
							}}
						>
							Close
						</button>
					</div>

					<div className="reader-speech-portal-controls">
						<button type="button" onClick={() => navigateToChapter(previousChapterNumber)} disabled={!hasPreviousChapter}>
							‹
						</button>
						<button type="button" onClick={handlePlaySpeech} disabled={!speechSupported}>
							{ttsStatus === "paused" ? "▶" : ttsStatus === "playing" ? "↻" : "▶"}
						</button>
						<button type="button" onClick={handlePauseSpeech} disabled={ttsStatus !== "playing"}>
							‖
						</button>
						<button type="button" onClick={() => stopSpeech()} disabled={ttsStatus === "idle"}>
							■
						</button>
						<button type="button" onClick={() => navigateToChapter(nextChapterNumber)} disabled={!hasNextChapter}>
							›
						</button>
					</div>

					<button
						type="button"
						className="reader-tool-button"
						onClick={() => {
							setReaderPanelTab("speech");
							setIsReaderPanelOpen(true);
							handleCloseSpeechPortal();
						}}
					>
						Open Speech Settings
					</button>
				</div>
			)}

			<div className={`reader-bottom-dock ${isReaderPanelOpen ? "open" : ""}`}>
				<button
					className="reader-dock-handle"
					onClick={() => setIsReaderPanelOpen((open) => !open)}
					aria-label={isReaderPanelOpen ? "Close reader controls" : "Open reader controls"}
				>
					{isReaderPanelOpen ? "⌄" : "⌃"}
				</button>

				{isReaderPanelOpen && (
					<div className="reader-dock-panel max-[860px]:max-h-[44vh] max-[860px]:overflow-auto max-[860px]:p-3">
						{readerPanelTab === "read" && (
							<div className="reader-dock-grid">
								<button className="reader-dock-action" disabled={!hasPreviousChapter} onClick={() => navigateToChapter(previousChapterNumber)}>
									<strong>Previous</strong>
									<span>Chapter {previousChapterNumber}</span>
								</button>
								<button className="reader-dock-action" onClick={() => setIsCatalogOpen(true)}>
									<strong>Contents</strong>
									<span>{catalogItems.length} indexed chapters</span>
								</button>
								<Link className="reader-dock-action" href={`/novels/${novelId}`}>
									<strong>Novel</strong>
									<span>{novel.title}</span>
								</Link>
								<button className="reader-dock-action" disabled={!hasNextChapter} onClick={() => navigateToChapter(nextChapterNumber)}>
									<strong>Next</strong>
									<span>Chapter {nextChapterNumber}</span>
								</button>
							</div>
						)}

						{readerPanelTab === "display" && (
							<div className="reader-settings-grid">
								<div>
									<label>Theme</label>
									<div className="reader-segmented wide">
										{(["light", "sepia", "dark"] as const).map((item) => (
											<button key={item} className={theme === item ? "active" : ""} onClick={() => handleThemeChange(item)}>
												{item}
											</button>
										))}
									</div>
								</div>
								<div>
									<label>Font Size</label>
									<div className="reader-segmented wide">
										<button onClick={() => handleFontSizeChange(false)}>A-</button>
										<button className="active">{fontSize}px</button>
										<button onClick={() => handleFontSizeChange(true)}>A+</button>
									</div>
								</div>
								<div>
									<label>Reader Width</label>
									<div className="reader-segmented wide">
										{(["narrow", "medium", "wide"] as const).map((item) => (
											<button key={item} className={readWidth === item ? "active" : ""} onClick={() => handleWidthChange(item)}>
												{item}
											</button>
										))}
									</div>
								</div>
							</div>
						)}

						{readerPanelTab === "speech" && (
							<div className="reader-settings-grid">
								<label className="reader-switch dock-switch">
									<input type="checkbox" checked={speechSupported} readOnly />
									<span></span>
									<strong>{speechSupported ? "Text-to-Speech Available" : "Text-to-Speech Unavailable"}</strong>
								</label>
								<label className="reader-switch dock-switch">
									<input type="checkbox" checked={autoOpenNext} onChange={(event) => handleAutoOpenNextChange(event.target.checked)} />
									<span></span>
									<strong>Continue into next chapter</strong>
								</label>
								<div>
									<label>Playback</label>
									<div className="reader-segmented wide">
										<button onClick={handlePlaySpeech}>
											{ttsStatus === "paused" ? "Resume" : ttsStatus === "playing" ? "Restart" : "Play"}
										</button>
										<button onClick={handlePauseSpeech} disabled={ttsStatus !== "playing"}>
											Pause
										</button>
										<button onClick={() => stopSpeech()} disabled={ttsStatus === "idle"}>
											Stop
										</button>
									</div>
								</div>
								<div>
									<label>Voice</label>
									<select
										className="reader-catalog-search"
										value={selectedVoiceURI}
										onChange={(event) => handleVoiceChange(event.target.value)}
									>
										<option value="">Browser default</option>
										{availableVoices.map((voice) => (
											<option key={voice.voiceURI} value={voice.voiceURI}>
												{voice.name} {voice.lang ? `(${voice.lang})` : ""}
											</option>
										))}
									</select>
								</div>
								<div>
									<label>Speed</label>
									<select
										className="reader-catalog-search"
										value={speechRate}
										onChange={(event) => handleSpeechRateChange(Number(event.target.value))}
									>
										{!hasSpeechRatePreset && <option value={speechRate}>{formatSpeechValue(speechRate)}x</option>}
										{SPEECH_RATE_PRESETS.map((preset) => (
											<option key={preset} value={preset}>
												{formatSpeechValue(preset)}x
											</option>
										))}
									</select>
								</div>
								<div>
									<label>Pitch</label>
									<select
										className="reader-catalog-search"
										value={speechPitch}
										onChange={(event) => handleSpeechPitchChange(Number(event.target.value))}
									>
										{!hasSpeechPitchPreset && <option value={speechPitch}>{formatSpeechValue(speechPitch)}x</option>}
										{SPEECH_PITCH_PRESETS.map((preset) => (
											<option key={preset} value={preset}>
												{formatSpeechValue(preset)}x
											</option>
										))}
									</select>
								</div>
							</div>
						)}

						{readerPanelTab === "settings" && (
							<div className="reader-settings-grid">
								{novel.rawChaptersTotal > 0 && (
									<div>
										<label>Reader Source</label>
										<div className="reader-segmented wide" aria-label="Reader source">
											<button className={!isRawReader ? "active" : ""} onClick={() => switchReaderSource("translated")}>
												Translated
											</button>
											<button className={isRawReader ? "active" : ""} onClick={() => switchReaderSource("raw")}>
												Raw
											</button>
										</div>
									</div>
								)}
								<label className="reader-switch dock-switch">
									<input type="checkbox" checked={autoOpenNext} onChange={(event) => handleAutoOpenNextChange(event.target.checked)} />
									<span></span>
									<strong>Continue TTS into next chapter</strong>
								</label>
								<div>
									<label>Reader Type</label>
									<div className="reader-segmented wide">
										<button className="active">Single Page</button>
										<button disabled>Infinite</button>
										<button disabled>Old Reader</button>
									</div>
								</div>
							</div>
						)}

						{readerPanelTab === "more" && (
							<div className="reader-dock-grid">
								{chapter.sourceUrl && (
									<a className="reader-dock-action" href={chapter.sourceUrl} target="_blank" rel="noreferrer">
										<strong>Raw</strong>
										<span>Go to source page</span>
									</a>
								)}
								<button className="reader-dock-action" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
									<strong>Top</strong>
									<span>Return to chapter title</span>
								</button>
								<Link className="reader-dock-action" href={user ? `/profile/novels/${novelId}` : "/login"}>
									<strong>{user ? "Profile Details" : "Login"}</strong>
									<span>{user ? "Open your private notes" : "Track reading progress"}</span>
								</Link>
							</div>
						)}
					</div>
				)}

				<nav className="reader-dock-tabs max-[860px]:[&>button]:min-h-12 max-[860px]:[&>button]:text-[0.69rem]">
					{(["read", "display", "speech", "settings", "more"] as const).map((tab) => (
						<button
							key={tab}
							className={readerPanelTab === tab ? "active" : ""}
							onClick={() => {
								setReaderPanelTab(tab);
								setIsReaderPanelOpen(true);
							}}
						>
							{tab}
						</button>
					))}
				</nav>
			</div>
		</div>
	);
}
