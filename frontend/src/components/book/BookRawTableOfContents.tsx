"use client";

import Link from "next/link";
import type { Book, ChapterContent } from "../../utils/api";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import type { CatalogItem } from "./book-details-helpers";

interface BookRawTableOfContentsProps {
	book: Book;
	rawChapters: Omit<ChapterContent, "content">[];
	sortedRawItems: CatalogItem[];
	chapterSearch: string;
	chapterSort: "asc" | "desc";
	firstReadableRawChapter: number;
	onSearchChange: (val: string) => void;
	onSortToggle: () => void;
}

export function BookRawTableOfContents({
	book,
	rawChapters,
	sortedRawItems,
	chapterSearch,
	chapterSort,
	firstReadableRawChapter,
	onSearchChange,
	onSortToggle,
}: BookRawTableOfContentsProps) {
	return (
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dfd6c8] pb-3">
				<div>
					<h2 className="text-base font-bold text-[#24211d]">Raw Table of Contents</h2>
					<p className="text-xs text-[#5f584f] mt-0.5">
						Archived raw: {rawChapters.length} / {book.rawChaptersTotal || sortedRawItems.length} chapters.
					</p>
				</div>
				<div className="flex gap-2 items-center flex-wrap">
					{sortedRawItems.length > 0 && (
						<>
							<input
								type="text"
								placeholder="Search raw..."
								value={chapterSearch}
								onChange={(e) => onSearchChange(e.target.value)}
								className="w-40 h-8 bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-2.5 text-xs outline-none transition-all duration-150 focus:bg-white focus:border-[#405f8f] focus:ring-4 focus:ring-[#405f8f]/10"
							/>
							<Button
								variant="secondary"
								size="sm"
								onClick={onSortToggle}
								className="h-8 text-xs font-semibold px-2.5 border-[#dfd6c8] hover:bg-slate-50"
							>
								{chapterSort === "asc" ? "oldest" : "newest"}
							</Button>
						</>
					)}
					{sortedRawItems.length > 0 && (
						<Button asChild variant="secondary" size="sm" className="h-8 text-xs font-semibold">
							<Link href={`/books/${book._id}/reader/${firstReadableRawChapter}?source=raw`}>Open Raw Reader</Link>
						</Button>
					)}
				</div>
			</div>

			{sortedRawItems.length === 0 ? (
				<p className="text-sm text-[#5f584f] mt-2">
					{sortedRawItems.length === 0 ? "No raw chapters have been indexed yet." : "No raw chapters match your search."}
				</p>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[520px] overflow-y-auto pr-1">
						{sortedRawItems.slice(0, 120).map((chapterItem) => (
							<Link
								key={chapterItem.chapterNumber}
								href={`/books/${book._id}/reader/${chapterItem.chapterNumber}?source=raw`}
								className={`grid gap-1 p-3 border border-[#dfd6c8] rounded-md transition-all duration-150 ${
									chapterItem.archived
										? "bg-[#f8f5ee] hover:bg-white hover:border-[#b9aa95]"
										: "bg-[#ece5d8]/40 hover:bg-[#f8f5ee] opacity-75 hover:opacity-100"
								}`}
							>
								<span className="text-[10px] font-black text-[#877d70] uppercase">Raw {chapterItem.chapterNumber}</span>
								<strong className="text-xs font-bold text-[#24211d] truncate">{chapterItem.title}</strong>
								{!chapterItem.archived && <small className="text-[9px] font-semibold text-[#877d70] uppercase">Indexed only</small>}
							</Link>
						))}
					</div>
					{sortedRawItems.length > 120 && (
						<p className="text-xs text-[#877d70] text-center mt-3 border-t border-slate-100 pt-3">
							Showing first 120 raw chapters. Use the search box to locate specific numbers.
						</p>
					)}
				</>
			)}
		</Card>
	);
}
