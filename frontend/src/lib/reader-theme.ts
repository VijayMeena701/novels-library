export type ReaderTheme = "paper" | "sepia" | "forest" | "night" | "amoled";

export const READER_THEMES: ReaderTheme[] = ["paper", "sepia", "forest", "night", "amoled"];

export interface ReaderThemeTokens {
	/** Page chrome/outer background. */
	background: string;
	/** Content area / reader surface. */
	reader: string;
	/** Elevated panels, buttons, inputs. */
	surface: string;
	/** Hover state for elevated surfaces. */
	surfaceHover: string;
	/** Primary text color. */
	text: string;
	/** Muted/secondary text. */
	muted: string;
	/** Border color. */
	border: string;
	/** Accent / interactive color. */
	accent: string;
	/** Hover state for accent. */
	accentHover: string;
	/** Low-opacity backdrop for modals / overlays. */
	overlay: string;
	/** Default paragraph highlight background for TTS. */
	paragraphHighlight: string;
	/** Default word highlight background for TTS. */
	wordHighlight: string;
}

export const READER_THEME_TOKENS: Record<ReaderTheme, ReaderThemeTokens> = {
	paper: {
		background: "#FFF8F1",
		reader: "#F2E7DB",
		surface: "#FFFDF8",
		surfaceHover: "#F7F0E6",
		text: "#2E2B27",
		muted: "#7A6F63",
		border: "#E8D3B7",
		accent: "#A96A4A",
		accentHover: "#8E563A",
		overlay: "rgba(46, 43, 39, 0.24)",
		paragraphHighlight: "#F5D67A",
		wordHighlight: "#F59E0B",
	},
	sepia: {
		background: "#F0E9C5",
		reader: "#FAE0A3",
		surface: "#FFF8E0",
		surfaceHover: "#F3E9BC",
		text: "#3B3320",
		muted: "#7A6B4E",
		border: "#E0B145",
		accent: "#A96A64",
		accentHover: "#8E554F",
		overlay: "rgba(59, 51, 32, 0.26)",
		paragraphHighlight: "#F7E6A8",
		wordHighlight: "#D97706",
	},
	forest: {
		background: "#182310",
		reader: "#2D3B20",
		surface: "#213019",
		surfaceHover: "#2A3F1F",
		text: "#E0E3A1",
		muted: "#9CA36B",
		border: "#0F3A23",
		accent: "#0FA73C",
		accentHover: "#0C8A30",
		overlay: "rgba(0, 0, 0, 0.55)",
		paragraphHighlight: "#3A4A28",
		wordHighlight: "#A3BE8C",
	},
	night: {
		background: "#111111",
		reader: "#1B1B1B",
		surface: "#232323",
		surfaceHover: "#2E2E2E",
		text: "#ECECEC",
		muted: "#A0A0A0",
		border: "#2A2A2A",
		accent: "#4960FF",
		accentHover: "#6B7FFF",
		overlay: "rgba(0, 0, 0, 0.65)",
		paragraphHighlight: "#3A3A3A",
		wordHighlight: "#6B7FFF",
	},
	amoled: {
		background: "#000000",
		reader: "#080808",
		surface: "#141414",
		surfaceHover: "#1F1F1F",
		text: "#E6E6E6",
		muted: "#9A9A9A",
		border: "#1A1A1A",
		accent: "#3D8DFF",
		accentHover: "#68A5FF",
		overlay: "rgba(0, 0, 0, 0.75)",
		paragraphHighlight: "#2A2A2A",
		wordHighlight: "#68A5FF",
	},
};

export function getThemeTokens(theme: ReaderTheme): ReaderThemeTokens {
	return READER_THEME_TOKENS[theme] ?? READER_THEME_TOKENS.paper;
}

const LEGACY_THEME_MAP: Record<string, ReaderTheme> = {
	light: "paper",
	dark: "night",
};

export function normalizeReaderTheme(value: string | undefined | null): ReaderTheme {
	if (!value) return "paper";
	if (READER_THEMES.includes(value as ReaderTheme)) return value as ReaderTheme;
	return LEGACY_THEME_MAP[value] ?? "paper";
}

export function applyReaderThemeCssVariables(theme: ReaderTheme): Record<string, string> {
	const tokens = getThemeTokens(theme);
	return {
		"--reader-bg": tokens.background,
		"--reader-surface": tokens.surface,
		"--reader-surface-hover": tokens.surfaceHover,
		"--reader-text": tokens.text,
		"--reader-muted": tokens.muted,
		"--reader-border": tokens.border,
		"--reader-accent": tokens.accent,
		"--reader-accent-hover": tokens.accentHover,
		"--reader-overlay": tokens.overlay,
		"--reader-paragraph-highlight": tokens.paragraphHighlight,
		"--reader-word-highlight": tokens.wordHighlight,
	};
}
