import { paperTheme } from "./paper";
import { sepiaTheme } from "./sepia";
import { forestTheme } from "./forest";
import { nightTheme } from "./night";
import { amoledTheme } from "./amoled";
import type { ColorTheme } from "../tokens/colors";

export type AppTheme = "paper" | "sepia" | "forest" | "night" | "amoled";

export const APP_THEMES: readonly AppTheme[] = ["paper","sepia","forest","night","amoled"];

export const themes: Record<AppTheme, ColorTheme> = {
	paper: paperTheme,
	sepia: sepiaTheme,
	forest: forestTheme,
	night: nightTheme,
	amoled: amoledTheme,
};

export function getTheme(theme: AppTheme): ColorTheme {
	return themes[theme] ?? themes.paper;
}

const LEGACY_THEME_MAP: Record<string, AppTheme> = {
	light: "paper",
	dark: "night",
};

export function normalizeAppTheme(value: string | undefined | null): AppTheme {
	if (!value) return "paper";
	if (APP_THEMES.includes(value as AppTheme)) return value as AppTheme;
	return LEGACY_THEME_MAP[value] ?? "paper";
}
