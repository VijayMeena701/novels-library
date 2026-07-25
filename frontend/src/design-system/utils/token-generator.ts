import { tokenToCssVariable } from "../tokens/colors";
import type { ColorTheme, ColorToken } from "../tokens/colors";
import type { AppTheme } from "../themes";

export { tokenToCssVariable };

/** Convert a theme color token map into CSS custom property declarations. */
export function themeToCssVariables(theme: ColorTheme): Record<string, string> {
	const variables: Record<string, string> = {};
	for (const token of Object.keys(theme) as ColorToken[]) {
		variables[tokenToCssVariable(token)] = theme[token];
	}
	return variables;
}

/** Generate the CSS variable scope for a specific app theme. */
export function getThemeCssVariables(themeName: AppTheme, theme: ColorTheme): Record<string, string> {
	return themeToCssVariables(theme);
}

/** Same as `themeToCssVariables` but retained for a stable public API. */
export function flattenTokens(theme: ColorTheme): Record<string, string> {
	return themeToCssVariables(theme);
}
