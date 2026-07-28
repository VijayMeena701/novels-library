import type { ColorTheme, ColorToken } from '../tokens/colors';
import { tokenToCssVariable } from './token-generator';

function entriesToCss(entries: Record<string, string>, indent = '\t'): string {
  return Object.entries(entries)
    .map(([key, value]) => `${indent}${key}: ${value};`)
    .join('\n');
}

/** Generate the `:root` and `[data-theme]` blocks for a set of themes. */
export function generateThemeCss(defaultThemeName: string, themes: Record<string, ColorTheme>): string {
  const defaultTheme = themes[defaultThemeName];
  if (!defaultTheme) {
    throw new Error(`Default theme "${defaultThemeName}" not found.`);
  }

  let css = `/* Auto-generated from the design-system theme definitions. */\n`;

  css += `\n:root {\n${entriesToCss(themeToCssVariables(defaultTheme))}\n}\n`;

  for (const [name, theme] of Object.entries(themes)) {
    if (name === defaultThemeName) continue;
    css += `\n[data-theme="${name}"],\n.theme-${name} {\n${entriesToCss(themeToCssVariables(theme))}\n}\n`;
  }

  return css;
}

function themeToCssVariables(theme: ColorTheme): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const token of Object.keys(theme) as ColorToken[]) {
    variables[tokenToCssVariable(token)] = theme[token];
  }
  return variables;
}
