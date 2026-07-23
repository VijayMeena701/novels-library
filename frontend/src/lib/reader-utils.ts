export type ReaderPanelTab = "read" | "display" | "speech" | "settings" | "more";
export type ReaderSource = "translated" | "raw";

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

export function normalizeHexColor(value: string, fallback: string): string {
	const normalized = value.trim().toLowerCase();
	return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function srgbToLinear(channel: number): number {
	const c = channel / 255;
	return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getLuminance(hex: string): number {
	const normalized = normalizeHexColor(hex, "#000000").slice(1);
	const r = srgbToLinear(Number.parseInt(normalized.slice(0, 2), 16));
	const g = srgbToLinear(Number.parseInt(normalized.slice(2, 4), 16));
	const b = srgbToLinear(Number.parseInt(normalized.slice(4, 6), 16));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastTextColor(hex: string): string {
	return getLuminance(hex) > 0.5 ? "#000000" : "#FFFFFF";
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

export function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return fallback;
}
