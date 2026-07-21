"use client";

import { useMemo } from "react";
import { type Book, type ChapterContent, type JobType, type SourceKind } from "../utils/api";
import { type ReaderCatalogChapter } from "../components/reader/ReaderCatalog";
import { resolveChapterTitle } from "../lib/reader-utils";

export interface UseReaderCatalogReturn {
	catalogItems: ReaderCatalogChapter[];
	currentCatalogIndex: number;
	currentCatalogItem: ReaderCatalogChapter | undefined;
	readerSourceKind: SourceKind;
	archiveJobType: JobType;
	currentSourceUrl: string;
	missingChapterTitle: string;
	previousChapterNumber: number;
	nextChapterNumber: number;
	hasPreviousChapter: boolean;
	hasNextChapter: boolean;
	indexedCurrentTitle: string | undefined;
	displayChapterTitle: string;
	totalChapters: number;
}

export function useReaderCatalog({
	isRawReader,
	book,
	chapters,
	chapter,
	chapterNumber,
}: {
	isRawReader: boolean;
	book: Book | null;
	chapters: Omit<ChapterContent, "content">[];
	chapter: ChapterContent | null;
	chapterNumber: number;
}): UseReaderCatalogReturn {
	const catalogItems = useMemo<ReaderCatalogChapter[]>(() => {
		if (!book) return [];

		const archivedByNumber = new Map(chapters.map((item) => [item.chapterNumber, item]));
		const seen = new Set<number>();
		const items: ReaderCatalogChapter[] = [];

		const indexedChapters = isRawReader ? book.rawChaptersList || [] : book.translatedChaptersList || [];

		for (const indexed of indexedChapters) {
			if (!indexed.chapterNumber || seen.has(indexed.chapterNumber)) continue;
			const archived = archivedByNumber.get(indexed.chapterNumber);
			items.push({
				chapterNumber: indexed.chapterNumber,
				title: resolveChapterTitle(book.title, indexed.chapterNumber, archived?.title, indexed.title),
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || indexed.url,
				scrapedAt: archived?.scrapedAt,
			});
			seen.add(indexed.chapterNumber);
		}

		for (const archived of chapters) {
			if (seen.has(archived.chapterNumber)) continue;
			items.push({
				chapterNumber: archived.chapterNumber,
				title: resolveChapterTitle(book.title, archived.chapterNumber, archived.title),
				archived: true,
				sourceUrl: archived.sourceUrl,
				scrapedAt: archived.scrapedAt,
			});
			seen.add(archived.chapterNumber);
		}

		return items.sort((a, b) => a.chapterNumber - b.chapterNumber);
	}, [isRawReader, book, chapters]);

	const currentCatalogIndex = useMemo(
		() => catalogItems.findIndex((item) => item.chapterNumber === chapterNumber),
		[catalogItems, chapterNumber],
	);
	const currentCatalogItem = currentCatalogIndex >= 0 ? catalogItems[currentCatalogIndex] : undefined;
	const readerSourceKind: SourceKind = isRawReader ? "raw" : "translated";
	const archiveJobType: JobType = isRawReader ? "scrape_raw_chapters" : "scrape_chapters";
	const currentSourceUrl = currentCatalogItem?.sourceUrl || chapter?.sourceUrl || "";
	const missingChapterTitle = currentCatalogItem?.title || `${isRawReader ? "Raw chapter" : "Chapter"} ${chapterNumber}`;

	const previousChapterNumber = currentCatalogIndex > 0 ? catalogItems[currentCatalogIndex - 1].chapterNumber : chapterNumber - 1;
	const nextChapterNumber =
		currentCatalogIndex >= 0 && currentCatalogIndex < catalogItems.length - 1
			? catalogItems[currentCatalogIndex + 1].chapterNumber
			: chapterNumber + 1;
	const hasPreviousChapter = currentCatalogIndex >= 0 ? currentCatalogIndex > 0 : chapterNumber > 1;
	const hasNextChapter =
		currentCatalogIndex >= 0
			? currentCatalogIndex < catalogItems.length - 1
			: Boolean(
					book &&
					!(
						(isRawReader ? book.rawChaptersTotal : book.translatedChaptersTotal) > 0 &&
						chapterNumber >= (isRawReader ? book.rawChaptersTotal : book.translatedChaptersTotal)
					),
				);

	const indexedCurrentTitle = useMemo(() => {
		const indexedChapters = isRawReader ? book?.rawChaptersList : book?.translatedChaptersList;
		return indexedChapters?.find((item) => item.chapterNumber === chapterNumber)?.title;
	}, [isRawReader, book, chapterNumber]);

	const displayChapterTitle = useMemo(() => {
		if (!book || !chapter) return `Chapter ${chapterNumber}`;
		return resolveChapterTitle(book.title, chapter.chapterNumber, chapter.title, indexedCurrentTitle);
	}, [chapter, chapterNumber, indexedCurrentTitle, book]);

	const totalChapters = isRawReader ? book?.rawChaptersTotal ?? 0 : book?.translatedChaptersTotal ?? 0;

	return {
		catalogItems,
		currentCatalogIndex,
		currentCatalogItem,
		readerSourceKind,
		archiveJobType,
		currentSourceUrl,
		missingChapterTitle,
		previousChapterNumber,
		nextChapterNumber,
		hasPreviousChapter,
		hasNextChapter,
		indexedCurrentTitle,
		displayChapterTitle,
		totalChapters,
	};
}
