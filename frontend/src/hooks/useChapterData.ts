"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Book, type ChapterContent, type User } from "../utils/api";
import { getErrorMessage } from "../lib/reader-utils";

export interface UseChapterDataReturn {
	book: Book | null;
	setBook: React.Dispatch<React.SetStateAction<Book | null>>;
	chapter: ChapterContent | null;
	chapters: Omit<ChapterContent, "content">[];
	loading: boolean;
	error: string;
	setError: React.Dispatch<React.SetStateAction<string>>;
	reloadCurrentChapter: () => Promise<void>;
}

export function useChapterData({
	bookId,
	chapterNumber,
	isRawReader,
	user,
}: {
	bookId: string | undefined;
	chapterNumber: number;
	isRawReader: boolean;
	user: User | null;
}): UseChapterDataReturn {
	const [book, setBook] = useState<Book | null>(null);
	const [chapter, setChapter] = useState<ChapterContent | null>(null);
	const [chapters, setChapters] = useState<Omit<ChapterContent, "content">[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const reloadCurrentChapter = useCallback(async () => {
		if (!bookId || Number.isNaN(chapterNumber)) return;
		const [chapterData, chaptersData] = isRawReader
			? await Promise.all([api.getPublicRawChapter(bookId, chapterNumber), api.getPublicRawChapters(bookId)])
			: await Promise.all([api.getPublicChapter(bookId, chapterNumber), api.getPublicChapters(bookId)]);

		setChapter(chapterData);
		setChapters(chaptersData);
		setError("");
	}, [chapterNumber, isRawReader, bookId]);

	useEffect(() => {
		let cancelled = false;

		async function loadChapter() {
			if (!bookId || Number.isNaN(chapterNumber)) return;
			setLoading(true);
			setError("");
			setChapter(null);

			try {
				const [bookData, chaptersData] = isRawReader
					? await Promise.all([api.getPublicBook(bookId), api.getPublicRawChapters(bookId)])
					: await Promise.all([api.getPublicBook(bookId), api.getPublicChapters(bookId)]);
				if (cancelled) return;
				setBook(bookData);
				setChapters(chaptersData);

				try {
					const chapterData = isRawReader
						? await api.getPublicRawChapter(bookId, chapterNumber)
						: await api.getPublicChapter(bookId, chapterNumber);
					if (cancelled) return;
					setChapter(chapterData);

					if (user && !isRawReader) {
						void api.recordChapterVisit(bookId, chapterData.chapterNumber).catch((visitErr) => {
							console.error("Failed to record chapter revisit:", visitErr);
						});

						if (chapterData.chapterNumber > bookData.chaptersRead) {
							void api.updateBook(bookId, { chaptersRead: chapterData.chapterNumber }).catch((updateErr) => {
								console.error("Failed to update reading progress:", updateErr);
							});
						}
					}
				} catch (chapterErr: unknown) {
					if (cancelled) return;
					setError(getErrorMessage(chapterErr, "This chapter has not been archived yet."));
				}
			} catch (err: unknown) {
				if (cancelled) return;
				console.error("Failed to load chapter content:", err);
				setError(getErrorMessage(err, "Could not load this reader page."));
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadChapter();

		return () => {
			cancelled = true;
		};
	}, [isRawReader, user, bookId, chapterNumber]);

	return { book, setBook, chapter, chapters, loading, error, setError, reloadCurrentChapter };
}
