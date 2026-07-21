"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import type { Book } from "../../utils/api";
import { type ReaderCatalogChapter } from "./ReaderCatalog";
import { Button } from "../ui/button";
import { Input, Textarea } from "../ui/input";

interface ReaderErrorStateProps {
	bookId: string;
	book: Book | null;
	chapterNumber: number;
	isRawReader: boolean;
	error: string;
	missingChapterTitle: string;
	currentSourceUrl: string;
	currentCatalogItem?: ReaderCatalogChapter;
	adminActionMessage: string;
	adminScrapingChapter: boolean;
	chapterHtmlPageUrl: string;
	chapterHtmlContent: string;
	importingChapterHtml: boolean;
	readerSourceKind: "translated" | "raw";
	canScrape: boolean;
	onScrape: () => void;
	onImport: (event: FormEvent) => void;
	onPageUrlChange: (value: string) => void;
	onContentChange: (value: string) => void;
}

export function ReaderErrorState({
	bookId,
	book,
	chapterNumber,
	isRawReader,
	error,
	missingChapterTitle,
	currentSourceUrl,
	currentCatalogItem,
	adminActionMessage,
	adminScrapingChapter,
	chapterHtmlPageUrl,
	chapterHtmlContent,
	importingChapterHtml,
	readerSourceKind,
	canScrape,
	onScrape,
	onImport,
	onPageUrlChange,
	onContentChange,
}: ReaderErrorStateProps) {
	return (
		<div className="mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12">
			<div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">
				<h2 className="mb-4 text-danger">{missingChapterTitle}</h2>
				<p className="mx-auto mb-8 max-w-[520px] text-copy">{error || "This chapter has not been archived yet."}</p>
				<div className="flex flex-wrap justify-center gap-4">
					<Button asChild variant="secondary">
						<Link href={`/books/${bookId}`}>Back to Book Index</Link>
					</Button>
					{currentSourceUrl && (
						<Button asChild>
							<a href={currentSourceUrl} target="_blank" rel="noreferrer">
								Open Source Page
							</a>
						</Button>
					)}
				</div>

				{canScrape && book && (
					<div className="mx-auto mt-8 w-[min(820px,100%)] rounded-lg border border-border bg-card p-6 text-left shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
						<h3 className="mb-2 text-[1.15rem]">Admin Recovery</h3>
						<p className="mb-4 text-[0.9rem] text-copy">
							Archive this {isRawReader ? "raw" : "translated"} chapter now, or paste the saved HTML for this source page.
						</p>

						<div className="mb-4 flex flex-wrap gap-3">
							<Button type="button" onClick={onScrape} disabled={adminScrapingChapter || !currentCatalogItem?.sourceUrl}>
								{adminScrapingChapter ? "Scraping..." : "Scrape This Chapter Now"}
							</Button>
							{currentSourceUrl && (
								<Button asChild variant="secondary">
									<a href={currentSourceUrl} target="_blank" rel="noreferrer">
										Open Source
									</a>
								</Button>
							)}
						</div>

						<form key={`${readerSourceKind}-${chapterNumber}`} onSubmit={onImport} className="grid gap-4">
							<div className="flex flex-col gap-2">
								<label className="text-sm font-semibold text-copy">Chapter Page URL</label>
								<Input
									type="url"
									value={chapterHtmlPageUrl || currentSourceUrl}
									onChange={(event) => onPageUrlChange(event.target.value)}
									placeholder="https://example.com/chapter"
									required
								/>
							</div>

							<div className="flex flex-col gap-2">
								<label className="text-sm font-semibold text-copy">Saved Chapter HTML</label>
								<Textarea
									rows={10}
									value={chapterHtmlContent}
									onChange={(event) => onContentChange(event.target.value)}
									placeholder="<html>..."
									required
								/>
							</div>

							<div className="flex flex-wrap items-center justify-between gap-4">
								<span className="text-[0.85rem] text-copy">
									{readerSourceKind === "raw" ? "Raw chapter" : "Translated chapter"} {chapterNumber}
								</span>
								<Button type="submit" disabled={importingChapterHtml}>
									{importingChapterHtml ? "Importing..." : "Import HTML"}
								</Button>
							</div>
						</form>

						{adminActionMessage && <p className="mt-4 text-[0.9rem] text-copy">{adminActionMessage}</p>}
					</div>
				)}
			</div>
		</div>
	);
}
