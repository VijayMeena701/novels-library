"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { type SourceKind } from "../utils/api";

export interface UseReaderNavigationReturn {
	navigateToChapter: (nextChapterNumber: number, options?: { resumeTts?: boolean }) => void;
	switchReaderSource: (source: SourceKind) => void;
}

export function useReaderNavigation({
	bookId,
	chapterNumber,
	readingSource,
}: {
	bookId: string | undefined;
	chapterNumber: number;
	readingSource: SourceKind;
}): UseReaderNavigationReturn {
	const router = useRouter();

	const navigateToChapter = useCallback(
		(nextChNum: number, options?: { resumeTts?: boolean }) => {
			const query = new URLSearchParams();
			if (readingSource === "raw") query.set("source", "raw");
			if (options?.resumeTts) query.set("tts", "1");
			const queryString = query.toString();
			router.push(`/books/${bookId}/reader/${nextChNum}${queryString ? `?${queryString}` : ""}`);
		},
		[bookId, readingSource, router],
	);

	const switchReaderSource = useCallback(
		(source: SourceKind) => {
			const query = new URLSearchParams();
			if (source === "raw") query.set("source", "raw");
			const queryString = query.toString();
			router.push(`/books/${bookId}/reader/${chapterNumber}${queryString ? `?${queryString}` : ""}`);
		},
		[bookId, chapterNumber, router],
	);

	return { navigateToChapter, switchReaderSource };
}
