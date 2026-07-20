"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ReaderTheme } from "../lib/reader-theme";

interface ReaderThemeContextValue {
	theme: ReaderTheme | null;
	setTheme: (theme: ReaderTheme | null) => void;
}

const ReaderThemeContext = createContext<ReaderThemeContextValue | undefined>(undefined);

export function ReaderThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<ReaderTheme | null>(null);
	return <ReaderThemeContext.Provider value={{ theme, setTheme }}>{children}</ReaderThemeContext.Provider>;
}

export function useReaderTheme() {
	const context = useContext(ReaderThemeContext);
	if (!context) {
		return { theme: null, setTheme: () => {} } as ReaderThemeContextValue;
	}
	return context;
}
