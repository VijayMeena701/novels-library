"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, type Book, type ChapterContent, type JobType, type SourceKind } from "../utils/api";
import { getErrorMessage } from "../lib/reader-utils";

export interface UseReaderAdminActionsReturn {
	translatingRawChapter: boolean;
	adminActionMessage: string;
	adminScrapingChapter: boolean;
	chapterHtmlPageUrl: string;
	setChapterHtmlPageUrl: React.Dispatch<React.SetStateAction<string>>;
	chapterHtmlContent: string;
	setChapterHtmlContent: React.Dispatch<React.SetStateAction<string>>;
	importingChapterHtml: boolean;
	handleGenerateTranslation: () => Promise<void>;
	handleScrapeCurrentChapterNow: () => Promise<void>;
	handleImportCurrentChapterHtml: (event: FormEvent) => Promise<void>;
}

export function useReaderAdminActions({
	bookId,
	book,
	chapter,
	chapterNumber,
	readerSourceKind,
	archiveJobType,
	currentSourceUrl,
	setBook,
	setError,
	reloadCurrentChapter,
}: {
	bookId: string | undefined;
	book: Book | null;
	chapter: ChapterContent | null;
	chapterNumber: number;
	readerSourceKind: SourceKind;
	archiveJobType: JobType;
	currentSourceUrl: string;
	setBook: React.Dispatch<React.SetStateAction<Book | null>>;
	setError: React.Dispatch<React.SetStateAction<string>>;
	reloadCurrentChapter: () => Promise<void>;
}): UseReaderAdminActionsReturn {
	const router = useRouter();

	const [translatingRawChapter, setTranslatingRawChapter] = useState(false);
	const [adminActionMessage, setAdminActionMessage] = useState("");
	const [adminScrapingChapter, setAdminScrapingChapter] = useState(false);
	const [chapterHtmlPageUrl, setChapterHtmlPageUrl] = useState("");
	const [chapterHtmlContent, setChapterHtmlContent] = useState("");
	const [importingChapterHtml, setImportingChapterHtml] = useState(false);

	const handleGenerateTranslation = useCallback(async () => {
		if (!bookId || !chapter) return;
		setTranslatingRawChapter(true);
		setError("");

		try {
			await api.translateRawChapter(bookId, chapter.chapterNumber, { targetLanguage: "English" });
			router.push(`/books/${bookId}/reader/${chapter.chapterNumber}`);
		} catch (err: unknown) {
			setError(getErrorMessage(err, "Could not generate translated chapter."));
		} finally {
			setTranslatingRawChapter(false);
		}
	}, [bookId, chapter, router, setError]);

	const handleScrapeCurrentChapterNow = useCallback(async () => {
		if (!book || !bookId) return;

		setAdminScrapingChapter(true);
		setAdminActionMessage("");
		try {
			const result = await api.runScrapeNow(bookId, archiveJobType, { chapterNumber });
			setBook(result.book);
			await reloadCurrentChapter();
			setAdminActionMessage(result.message || "Chapter archived.");
		} catch (err: unknown) {
			setAdminActionMessage(getErrorMessage(err, "Could not archive this chapter."));
		} finally {
			setAdminScrapingChapter(false);
		}
	}, [archiveJobType, book, bookId, chapterNumber, reloadCurrentChapter, setBook]);

	const handleImportCurrentChapterHtml = useCallback(
		async (event: FormEvent) => {
			event.preventDefault();
			if (!book || !bookId) return;

			setImportingChapterHtml(true);
			setAdminActionMessage("");
			try {
				const result = await api.importChapterHtml(bookId, {
					sourceKind: readerSourceKind,
					chapterNumber,
					pageUrl: chapterHtmlPageUrl || currentSourceUrl,
					html: chapterHtmlContent,
				});
				await reloadCurrentChapter();
				setAdminActionMessage(result.message || "Chapter HTML imported.");
				setChapterHtmlContent("");
			} catch (err: unknown) {
				setAdminActionMessage(getErrorMessage(err, "Could not import chapter HTML."));
			} finally {
				setImportingChapterHtml(false);
			}
		},
		[book, bookId, chapterHtmlContent, chapterHtmlPageUrl, chapterNumber, currentSourceUrl, readerSourceKind, reloadCurrentChapter],
	);

	return {
		translatingRawChapter,
		adminActionMessage,
		adminScrapingChapter,
		chapterHtmlPageUrl,
		setChapterHtmlPageUrl,
		chapterHtmlContent,
		setChapterHtmlContent,
		importingChapterHtml,
		handleGenerateTranslation,
		handleScrapeCurrentChapterNow,
		handleImportCurrentChapterHtml,
	};
}
