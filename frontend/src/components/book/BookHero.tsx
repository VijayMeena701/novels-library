"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Book, User } from "../../utils/api";
import { getLoginHref } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { getAuthor } from "./book-details-helpers";

interface BookHeroProps {
	book: Book;
	chaptersCount: number;
	rawCatalogCount: number;
	coverSrc: string;
	user: User | null;
	isUserBook: boolean;
	adding: boolean;
	addMessage: string;
	firstReadableChapter: number;
	continueChapter: number;
	firstReadableRawChapter: number;
	onAddToLibrary: () => void;
	voting: boolean;
	voted: boolean;
	onVote: () => void;
}

export function BookHero({
	book,
	chaptersCount,
	rawCatalogCount,
	coverSrc,
	user,
	isUserBook,
	adding,
	addMessage,
	firstReadableChapter,
	continueChapter,
	firstReadableRawChapter,
	onAddToLibrary,
	voting,
	voted,
	onVote,
}: BookHeroProps) {
	const pathname = usePathname();
	const translatedChaptersTotal = book.translatedChaptersTotal || chaptersCount || 1;
	const archivePercentage = Math.min(100, Math.round((chaptersCount / translatedChaptersTotal) * 100));
	const resumeChapter = continueChapter > 0 ? continueChapter : firstReadableChapter;
	const isContinue = continueChapter > 0 && continueChapter !== firstReadableChapter;

	return (
		<Card className="p-[1.1rem] flex flex-col md:flex-row gap-6 bg-[#fffdf8] border-[#dfd6c8] shadow-md">
			<div className="w-[190px] h-[260px] flex-shrink-0 border border-[#dfd6c8] rounded-lg bg-[#f8f5ee] flex items-center justify-center overflow-hidden mx-auto md:mx-0">
				{coverSrc ? (
					<Image src={coverSrc} alt={book.title} width={190} height={260} unoptimized className="w-full h-full object-cover" />
				) : (
					<span className="text-3xl font-extrabold text-[#405f8f] opacity-50">{book.title.slice(0, 2).toUpperCase()}</span>
				)}
			</div>

			<div className="flex-1 min-width-0 flex flex-col gap-4 text-[#24211d]">
				<div>
					<h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-[#24211d]">{book.title}</h1>
					{(book.alternativeNames || []).length > 0 && (
						<p className="text-sm text-[#5f584f] mt-1 italic">{book.alternativeNames.slice(0, 3).join(" · ")}</p>
					)}
					<p className="text-[#5f584f] mt-1.5 text-sm md:text-base">
						By{" "}
						{book.authorId ? (
							<Link href={`/authors/${book.authorId}`} className="text-[#405f8f] hover:underline font-semibold">
								{getAuthor(book)}
							</Link>
						) : (
							<span className="font-semibold">{getAuthor(book)}</span>
						)}
					</p>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Status</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{book.publicationStatus || "Unknown"}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Chapters</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{book.translatedChaptersTotal || chaptersCount || "?"}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Archived</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{chaptersCount}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Raw</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{book.rawChaptersTotal || 0}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Rating</span>
						<strong className="text-[#24211d] font-extrabold text-sm">
							{book.ratingAverage ? book.ratingAverage.toFixed(1) : "—"}
							{book.ratingCount ? <span className="text-[#877d70] font-semibold text-xs ml-1">({book.ratingCount})</span> : null}
						</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Reviews</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{book.reviewCount || 0}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Votes</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{book.totalVotes || 0}</strong>
					</div>
				</div>

				<div className="my-1">
					<div className="flex justify-between text-xs font-bold mb-1.5">
						<span className="text-[#5f584f]">Archive Progress</span>
						<span className="text-[#405f8f]">
							{chaptersCount} / {book.translatedChaptersTotal || chaptersCount || "?"} chapters ({archivePercentage}%)
						</span>
					</div>
					<div className="w-full h-1.5 bg-[#e8dfd1] rounded-full overflow-hidden">
						<div
							className="h-full bg-gradient-to-r from-[#405f8f] to-[#b65f3d] rounded-full transition-all duration-300"
							style={{ width: `${archivePercentage}%` }}
						></div>
					</div>
				</div>

				<div className="flex flex-wrap gap-2.5 mt-2">
					{user ? (
						isUserBook ? (
							<Button
								variant="secondary"
								disabled
								className="h-9 font-semibold text-xs border-[#dfd6c8] bg-[#f8f5ee] text-[#5f584f] cursor-default"
							>
								In Your Library
							</Button>
						) : (
							<Button
								variant="secondary"
								onClick={onAddToLibrary}
								disabled={adding}
								className="h-9 font-semibold text-xs border-[#dfd6c8] hover:bg-white"
							>
								{adding ? (
									<div className="w-4 h-4 border-2 border-slate-300 border-t-[#405f8f] rounded-full animate-spin" />
								) : (
									"Add to Profile Library"
								)}
							</Button>
						)
					) : (
						<Button asChild variant="secondary" className="h-9 font-semibold text-xs">
							<Link href={getLoginHref(pathname)}>Login to Track</Link>
						</Button>
					)}
					{user && (
						<Button
							variant={voted ? "default" : "secondary"}
							onClick={onVote}
							disabled={voting}
							className="h-9 font-semibold text-xs"
						>
							{voting ? (
								<div className="w-4 h-4 border-2 border-slate-300 border-t-[#405f8f] rounded-full animate-spin" />
							) : voted ? (
								`Unvote (${book.totalVotes || 0})`
							) : (
								`Vote (${book.totalVotes || 0})`
							)}
						</Button>
					)}
					{chaptersCount > 0 ? (
						<Button asChild className="h-9 font-semibold text-xs bg-[#405f8f] hover:bg-[#304a72] text-white">
							<Link href={`/books/${book._id}/reader/${resumeChapter}`}>
								{isContinue ? "Continue Reading" : "Start Reading"}
							</Link>
						</Button>
					) : book.sourceUrl ? (
						<Button asChild className="h-9 font-semibold text-xs bg-[#405f8f] hover:bg-[#304a72] text-white">
							<a href={book.sourceUrl} target="_blank" rel="noreferrer">
								Open Source
							</a>
						</Button>
					) : null}
					{rawCatalogCount > 0 && (
						<Button asChild variant="secondary" className="h-9 font-semibold text-xs">
							<Link href={`/books/${book._id}/reader/${firstReadableRawChapter}?source=raw`}>Open Raw</Link>
						</Button>
					)}
					{book.rawSourceUrl && rawCatalogCount === 0 && (
						<Button asChild variant="secondary" className="h-9 font-semibold text-xs">
							<a href={book.rawSourceUrl} target="_blank" rel="noreferrer">
								Open Raw Source
							</a>
						</Button>
					)}
				</div>
				{addMessage && <p className="text-xs text-[#5f584f] italic mt-1">{addMessage}</p>}

				<div className="flex flex-wrap gap-1.5 mt-1">
					{(book.genres || []).map((genre) => (
						<Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
							<Badge className="bg-[#fffdf8] border-[#dfd6c8] text-[#5d6474] hover:bg-[#f8f5ee] font-bold text-[10px] uppercase tracking-wider py-1">
								{genre}
							</Badge>
						</Link>
					))}
				</div>
			</div>
		</Card>
	);
}
