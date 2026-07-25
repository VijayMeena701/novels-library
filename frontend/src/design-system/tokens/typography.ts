/**
 * Typography system.
 *
 * One consistent scale used across every theme.
 */

export type FontFamilyToken = "sans" | "serif";

export const FONT_FAMILY: Record<FontFamilyToken, string> = {
	sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	serif: "Literata, Georgia, serif",
};

export type TextSizeToken =
	| "display"
	| "h1"
	| "h2"
	| "h3"
	| "title"
	| "subtitle"
	| "body"
	| "small"
	| "caption"
	| "metadata";

export const FONT_SIZE: Record<TextSizeToken, string> = {
	display: "2.25rem", // 36px
	h1: "1.875rem", // 30px
	h2: "1.5rem", // 24px
	h3: "1.25rem", // 20px
	title: "1.125rem", // 18px
	subtitle: "0.9375rem", // 15px
	body: "0.875rem", // 14px
	small: "0.8125rem", // 13px
	caption: "0.75rem", // 12px
	metadata: "0.6875rem", // 11px
};

export type FontWeightToken = "regular" | "medium" | "semibold" | "bold" | "extrabold";

export const FONT_WEIGHT: Record<FontWeightToken, number> = {
	regular: 400,
	medium: 500,
	semibold: 600,
	bold: 700,
	extrabold: 800,
};

export type LineHeightToken = "tight" | "snug" | "normal" | "relaxed" | "loose";

export const LINE_HEIGHT: Record<LineHeightToken, number> = {
	tight: 1.2,
	snug: 1.35,
	normal: 1.5,
	relaxed: 1.65,
	loose: 1.9,
};

export type LetterSpacingToken = "tighter" | "tight" | "normal" | "wide" | "wider";

export const LETTER_SPACING: Record<LetterSpacingToken, string> = {
	tighter: "-0.03em",
	tight: "-0.015em",
	normal: "0em",
	wide: "0.025em",
	wider: "0.05em",
};
