import plugin from 'tailwindcss/plugin';
import { themes, APP_THEMES } from '../themes';
import { tokenToCssVariable } from '../tokens/colors';

export const designSystemPlugin = plugin(function ({ addBase }) {
  const base: Record<string, Record<string, string>> = {};

  const defaultTheme = themes.paper;
  const rootVars: Record<string, string> = {};
  for (const token of Object.keys(defaultTheme)) {
    rootVars[tokenToCssVariable(token)] = defaultTheme[token as keyof typeof defaultTheme];
  }
  base[':root'] = rootVars;

  for (const themeName of APP_THEMES) {
    if (themeName === 'paper') continue;
    const theme = themes[themeName];
    const vars: Record<string, string> = {};
    for (const token of Object.keys(theme)) {
      vars[tokenToCssVariable(token)] = theme[token as keyof typeof theme];
    }
    base[`[data-theme="${themeName}"]`] = vars;
    base[`.theme-${themeName}`] = vars;
  }

  addBase(base);
});
