"use client";

import type { Book, ChapterContent } from "../../utils/api";

interface ReaderChapterHeaderProps {
	book: Book;
	chapter: ChapterContent;
	displayChapterTitle: string;
	isRawReader: boolean;
	translatingRawChapter: boolean;
	onGenerateTranslation: () => void;
	canTranslate: boolean;
}

export function ReaderChapterHeader({
	book,
	chapter,
	displayChapterTitle,
	isRawReader,
	translatingRawChapter,
	onGenerateTranslation,
	canTranslate,
}: ReaderChapterHeaderProps) {
	const totalChapters = isRawReader ? book.rawChaptersTotal : book.translatedChaptersTotal;

	return (
		<header className="border-b border-reader pb-8">
			<h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight max-[860px]:text-[1.45rem]">{displayChapterTitle}</h1>
			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-reader-muted">
				<span>{book.title}</span>
				<span className="hidden sm:inline" aria-hidden="true">·</span>
				<span>
					{isRawReader ? "Raw" : "Translated"} chapter {chapter.chapterNumber}
					{totalChapters ? ` of ${totalChapters}` : ""}
				</span>
				{chapter.sourceUrl && (
					<>
						<span className="hidden sm:inline" aria-hidden="true">·</span>
						<a href={chapter.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 transition hover:text-reader-paragraph">
							Source
						</a>
					</>
				)}
			</div>
			{isRawReader && canTranslate && (
				<div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-reader bg-reader px-4 py-3 text-[0.75rem] font-medium text-reader-muted">
					<span>Raw source view</span>
					<button
						type="button"
						className="ml-auto min-h-8 rounded-md bg-reader-accent px-3 py-1.5 text-xs font-semibold text-inverse transition hover:bg-reader-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
						onClick={onGenerateTranslation}
						disabled={translatingRawChapter}
					>
						{translatingRawChapter ? "Generating..." : "Generate English"}
					</button>
				</div>
			)}
		</header>
	);
}
