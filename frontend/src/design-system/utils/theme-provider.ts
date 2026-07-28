'use client';

import type { AppTheme } from '../themes';

const THEME_ATTRIBUTE = 'data-theme';
const THEME_STORAGE_KEY = 'books_app_theme';

export function applyThemeAttribute(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

export function getStoredTheme(): AppTheme | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (!stored) return null;
  return stored as AppTheme;
}

export function storeTheme(theme: AppTheme): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export { THEME_STORAGE_KEY, THEME_ATTRIBUTE };
