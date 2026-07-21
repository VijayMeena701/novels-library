import type { PronunciationRule } from "../utils/api";

export type TtsStatus = "idle" | "playing" | "paused";
export type ReaderPanelTab = "read" | "display" | "speech" | "settings" | "more";
export type ReaderSource = "translated" | "raw";

export interface SpeechChunk {
	text: string;
	startOffset: number;
}

export interface SpeechQueueItem {
	text: string;
	spokenText: string;
	blockIndex: number;
	startOffset: number;
}

export interface SpeechBlock {
	element: HTMLElement;
	text: string;
}

export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 4;
export const SPEECH_PITCH_MIN = 0.5;
export const SPEECH_PITCH_MAX = 2;
export const SPEECH_BLOCK_SELECTOR = "p, li, blockquote, h1, h2, h3, h4, div";
export const DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR = "#f5d67a";
export const DEFAULT_WORD_HIGHLIGHT_COLOR = "#f59e0b";
export const TTS_SESSION_FLAG = "books_reader_user_started_tts";

export function getScrollParent(node: HTMLElement | null): HTMLElement | Window {
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

export function isSpeechLeafBlock(element: HTMLElement): boolean {
	if (element.tagName !== "DIV") return true;

	// Ignore wrapper containers so playback follows real content blocks.
	return !Array.from(element.children).some((child) => {
		if (!(child instanceof HTMLElement)) return false;
		return ["P", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "DIV"].includes(child.tagName);
	});
}

export function normalizeTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isGenericChapterTitle(value: string, bookTitle: string, chapterNumber: number): boolean {
	const normalized = normalizeTitle(value);
	return !normalized || normalized === normalizeTitle(bookTitle) || normalized === `chapter ${chapterNumber}` || normalized === `ch ${chapterNumber}`;
}

export function resolveChapterTitle(bookTitle: string, chapterNumber: number, archivedTitle?: string, indexedTitle?: string): string {
	const archived = archivedTitle?.trim() || "";
	const indexed = indexedTitle?.trim() || "";

	if (indexed && isGenericChapterTitle(archived, bookTitle, chapterNumber)) {
		return indexed;
	}

	return archived || indexed || `Chapter ${chapterNumber}`;
}

export function splitSpeechTextWithOffsets(text: string, maxLength = 1800): SpeechChunk[] {
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

export function normalizeHexColor(value: string, fallback: string): string {
	const normalized = value.trim().toLowerCase();
	return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isLetter(char: string): boolean {
	return /^\p{Letter}$/u.test(char);
}

export function buildWholeWordPattern(pattern: string): string {
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
export function applyPronunciationRules(text: string, rules: PronunciationRule[]): string {
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

export function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return fallback;
}
