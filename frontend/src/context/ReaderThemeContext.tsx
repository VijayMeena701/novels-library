"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../utils/api";
import { getTheme, normalizeAppTheme, type AppTheme } from "../design-system/themes";
import { applyThemeAttribute } from "../design-system/utils/theme-provider";

interface ReaderThemeContextValue {
	theme: AppTheme;
	setTheme: (theme: AppTheme) => void;
	ready: boolean;
}

const ReaderThemeContext = createContext<ReaderThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = "books_app_theme";

export function ReaderThemeProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const [theme, setThemeState] = useState<AppTheme>("paper");
	const [ready, setReady] = useState(false);

	useEffect(() => {
		async function loadTheme() {
			if (user) {
				try {
					const settings = await api.getSettings();
					if (settings.reader?.theme) {
						setThemeState(normalizeAppTheme(settings.reader.theme));
					}
				} catch {
					// ignore
				}
			} else {
				try {
					const saved = localStorage.getItem(THEME_STORAGE_KEY);
					if (saved) {
						setThemeState(normalizeAppTheme(saved));
					}
				} catch {
					// ignore
				}
			}
			setReady(true);
		}
		void loadTheme();
	}, [user]);

	const setTheme = useCallback(
		(next: AppTheme) => {
			const normalized = normalizeAppTheme(next);
			setThemeState(normalized);
			applyThemeAttribute(normalized);
			try {
				localStorage.setItem(THEME_STORAGE_KEY, normalized);
			} catch {
				// ignore
			}
			if (user) {
				api.updateSettings({ reader: { theme: normalized } }).catch(() => {});
			}
		},
		[user],
	);

	useEffect(() => {
		applyThemeAttribute(theme);
	}, [theme]);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const appBackground = getTheme(theme)["color.background.app"];
		let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = "theme-color";
			document.head.appendChild(meta);
		}
		meta.content = appBackground;
	}, [theme]);

	const value = useMemo(() => ({ theme, setTheme, ready }), [theme, setTheme, ready]);
	return <ReaderThemeContext.Provider value={value}>{children}</ReaderThemeContext.Provider>;
}

export function useReaderTheme() {
	const context = useContext(ReaderThemeContext);
	if (!context) {
		return { theme: "paper" as AppTheme, setTheme: () => {}, ready: true };
	}
	return context;
}
