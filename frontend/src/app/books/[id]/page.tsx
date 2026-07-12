"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, getBookCoverUrl, type BackgroundJob, type BookContent, type BookReview, type JobType, type Book, type SourceKind, type User } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { CAPABILITY } from "../../../utils/permissions";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { BookLibraryPanel } from "../../../components/BookLibraryPanel";

// ==========================================
// UTILS & HELPER FUNCTIONS
// ==========================================

function getAuthor(book: Book): string {
	return book.authorPenName || book.author || book.authorRealName || "Unknown Author";
}

function normalizeTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isGenericUnitTitle(value: string, bookTitle: string, unitNumber: number): boolean {
	const normalized = normalizeTitle(value);
	return !normalized || normalized === normalizeTitle(bookTitle) || normalized === `unit ${unitNumber}` || normalized === `ch ${unitNumber}`;
}

function formatJobTypeLabel(type: JobType): string {
	const labels: Record<JobType, string> = {
		scrape_metadata: "Translated index",
		scrape_units: "Translated archive",
		scrape_raw_metadata: "Raw index",
		scrape_raw_units: "Raw archive",
	};
	return labels[type];
}

function formatJobStatusLabel(status: BackgroundJob["status"]): string {
	return status.replace(/_/g, " ");
}

function formatActivityTime(timestamp: string): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(timestamp));
}

function getJobBadgeVariant(status: BackgroundJob["status"]): "processing" | "completed" | "hold" | "dropped" | "default" {
	switch (status) {
		case "processing":
		case "pending":
			return "processing";
		case "completed":
			return "completed";
		case "requires_manual_intervention":
			return "hold";
		case "failed":
			return "dropped";
		default:
			return "default";
	}
}

type CatalogItem = {
	unitNumber: number;
	title: string;
	archived: boolean;
	sourceUrl?: string;
	scrapedAt?: string;
};

type PipelineAction = {
	key: string;
	label: string;
	tone: string;
	disabled: boolean;
	busy?: boolean;
	onClick: () => void;
};

type PipelineSection = {
	key: string;
	title: string;
	actions: PipelineAction[];
};

type CommonAdminAction =
	| { key: string; label: string; tone: string; disabled: boolean; onClick: () => void }
	| { key: string; label: string; tone: string; disabled: boolean; href: string };

// ==========================================
// SUB-COMPONENTS (REUSABLE PORTIONS)
// ==========================================

// --- Hero section for cover art, primary tracking features, and title stats ---
interface HeroProps {
	book: Book;
	unitsCount: number;
	rawCatalogCount: number;
	coverSrc: string;
	user: User | null;
	adding: boolean;
	addMessage: string;
	firstReadableUnit: number;
	firstReadableRawUnit: number;
	onAddToLibrary: () => void;
	voting: boolean;
	voted: boolean;
	onVote: () => void;
}

function BookHero({
	book,
	unitsCount,
	rawCatalogCount,
	coverSrc,
	user,
	adding,
	addMessage,
	firstReadableUnit,
	firstReadableRawUnit,
	onAddToLibrary,
	voting,
	voted,
	onVote,
}: HeroProps) {
	const translatedUnitsTotal = book.translatedUnitsTotal || unitsCount || 1;
	const archivePercentage = Math.min(100, Math.round((unitsCount / translatedUnitsTotal) * 100));

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
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Units</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{book.translatedUnitsTotal || unitsCount || "?"}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Archived</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{unitsCount}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Raw</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{book.rawUnitsTotal || 0}</strong>
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
							{unitsCount} / {book.translatedUnitsTotal || unitsCount || "?"} units ({archivePercentage}%)
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
					) : (
						<Button asChild variant="secondary" className="h-9 font-semibold text-xs">
							<Link href="/login">Login to Track</Link>
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
					{unitsCount > 0 ? (
						<Button asChild className="h-9 font-semibold text-xs bg-[#405f8f] hover:bg-[#304a72] text-white">
							<Link href={`/books/${book._id}/reader/${firstReadableUnit}`}>Start Reading</Link>
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
							<Link href={`/books/${book._id}/reader/${firstReadableRawUnit}?source=raw`}>Open Raw</Link>
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

// --- Admin Controls Console Block ---
interface AdminConsoleProps {
	book: Book;
	jobs: BackgroundJob[];
	activeJobTypes: Set<JobType>;
	processingJobCount: number;
	translatedArchivePercent: number;
	translatedPipelineSections: PipelineSection[];
	rawPipelineSections: PipelineSection[];
	commonAdminActions: CommonAdminAction[];
	adminMessage: string;
}

function AdminConsole({
	book,
	jobs,
	activeJobTypes,
	processingJobCount,
	translatedArchivePercent,
	translatedPipelineSections,
	rawPipelineSections,
	commonAdminActions,
	adminMessage,
}: AdminConsoleProps) {
	const recentJobs = jobs.slice(0, 5);

	return (
		<Card className="p-[1.1rem] bg-gradient-to-b from-[#fffdf8] to-[#faf6ee] border-[#dfd6c8] flex flex-col gap-6 shadow-sm">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<span className="block text-[10px] font-black tracking-wider text-[#877d70] uppercase mb-1">Catalog administration</span>
					<h2 className="text-xl font-bold uppercase text-[#24211d]">{book.title}</h2>
					<p className="text-sm text-[#5f584f] mt-1">
						Manage this shared book record, queue indexing jobs, import unit index HTML, and update catalog metadata.
					</p>
				</div>
				<Button asChild variant="secondary" size="sm" className="h-8 text-xs font-semibold">
					<Link href="/scraper">Scraper Dashboard</Link>
				</Button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div className="p-4 border border-[#dfd6c8] rounded-md bg-[#f8f5ee] flex flex-col">
					<div className="flex justify-between items-center mb-1">
						<span className="text-[10px] font-bold tracking-wider text-[#877d70] uppercase">Active jobs</span>
						<span
							className={`w-2.5 h-2.5 rounded-full transition-all ${activeJobTypes.size > 0 ? "bg-[#d97706] shadow-[0_0_8px_rgba(217,119,6,0.5)] animate-pulse" : "bg-[#877d70]/40"}`}
						></span>
					</div>
					<strong className="text-2xl font-extrabold text-[#24211d]">{activeJobTypes.size}</strong>
				</div>

				<div className="p-4 border border-[#dfd6c8] rounded-md bg-[#f8f5ee] flex flex-col">
					<div className="flex justify-between items-center mb-1">
						<span className="text-[10px] font-bold tracking-wider text-[#877d70] uppercase">Queued / Processing</span>
						<span
							className={`w-2.5 h-2.5 rounded-full transition-all ${processingJobCount > 0 ? "bg-[#d97706] shadow-[0_0_8px_rgba(217,119,6,0.5)] animate-pulse" : "bg-[#877d70]/40"}`}
						></span>
					</div>
					<strong className="text-2xl font-extrabold text-[#24211d]">{processingJobCount}</strong>
				</div>

				<div className="p-4 border border-[#dfd6c8] rounded-md bg-[#f8f5ee] flex flex-col justify-between">
					<div className="flex justify-between items-center mb-1">
						<span className="text-[10px] font-bold tracking-wider text-[#877d70] uppercase">Indexed units</span>
						<span className="text-xs font-bold text-[#405f8f]">{translatedArchivePercent}%</span>
					</div>
					<strong className="text-lg font-extrabold text-[#24211d]">
						{book.translatedUnitsList?.length || 0} / {book.translatedUnitsTotal || "?"}
					</strong>
					<div className="w-full h-1.5 bg-[#e8dfd1] rounded-full overflow-hidden mt-2">
						<div className="h-full bg-[#405f8f] rounded-full transition-all duration-300" style={{ width: `${translatedArchivePercent}%` }}></div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
				{/* Translated data pipeline */}
				<section className="p-4 border border-[#b9aa95]/40 rounded-lg bg-[#fffcf6] shadow-sm flex flex-col gap-4">
					<div className="border-b border-[#dfd6c8] pb-2">
						<span className="text-[10px] font-bold tracking-wider text-[#877d70] uppercase">Translated data pipeline</span>
						<h3 className="text-sm font-black text-[#24211d] uppercase">Translated Flow</h3>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{translatedPipelineSections.map((section) => (
							<div key={section.key} className="p-4 border border-[#dfd6c8] rounded-md bg-white flex flex-col gap-3">
								<h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[#5f584f]">{section.title}</h4>
								<div className="flex flex-col gap-2">
									{section.actions.map((action) => (
										<Button
											key={action.key}
											variant="secondary"
											size="sm"
											className="w-full text-xs font-semibold py-1.5 px-3 whitespace-normal leading-normal transition-all"
											onClick={action.onClick}
											disabled={action.disabled}
										>
											{action.busy ? "Working..." : action.label}
										</Button>
									))}
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Raw data pipeline */}
				<section className="p-4 border border-[#b9aa95]/40 rounded-lg bg-[#fffcf6] shadow-sm flex flex-col gap-4">
					<div className="border-b border-[#dfd6c8] pb-2">
						<span className="text-[10px] font-bold tracking-wider text-[#877d70] uppercase">Raw data pipeline</span>
						<h3 className="text-sm font-black text-[#24211d] uppercase">Raw Flow</h3>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{rawPipelineSections.map((section) => (
							<div key={section.key} className="p-4 border border-[#dfd6c8] rounded-md bg-white flex flex-col gap-3">
								<h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[#5f584f]">{section.title}</h4>
								<div className="flex flex-col gap-2">
									{section.actions.map((action) => (
										<Button
											key={action.key}
											variant="secondary"
											size="sm"
											className="w-full text-xs font-semibold py-1.5 px-3 whitespace-normal leading-normal transition-all"
											onClick={action.onClick}
											disabled={action.disabled}
										>
											{action.busy ? "Working..." : action.label}
										</Button>
									))}
								</div>
							</div>
						))}
					</div>
				</section>
			</div>

			<div className="p-4 border border-[#dfd6c8] rounded-md bg-[#fffdf8] flex flex-col gap-3">
				<h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5f584f]">Common Catalog Tools</h4>
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
					{commonAdminActions.map((action) => {
						if (!action) return null;
						return "href" in action ? (
							<Button
								key={action.key}
								asChild
								variant="secondary"
								size="sm"
								className="text-xs font-semibold py-2 w-full border-[#dfd6c8] hover:bg-white"
							>
								<a href={action.href} target="_blank" rel="noreferrer">
									{action.label}
								</a>
							</Button>
						) : (
							<Button
								key={action.key}
								variant="secondary"
								size="sm"
								className="text-xs font-semibold py-2 w-full border-[#dfd6c8] hover:bg-white"
								onClick={action.onClick}
								disabled={action.disabled}
							>
								{action.label}
							</Button>
						);
					})}
				</div>
			</div>

			{adminMessage && <div className="p-3.5 border border-[#405f8f]/20 rounded-md bg-[#e9eef8]/80 text-[#24211d] text-sm">{adminMessage}</div>}

			<section className="p-4 border border-[#dfd6c8] rounded-md bg-white flex flex-col gap-4">
				<div className="flex justify-between items-baseline border-b border-[#dfd6c8] pb-2">
					<h3 className="text-sm font-bold text-[#24211d] uppercase">Recent Activity</h3>
					<span className="text-[10px] font-black text-[#877d70] tracking-wider uppercase">Scrape log</span>
				</div>
				{recentJobs.length > 0 ? (
					<div className="grid border border-[#dfd6c8]/80 rounded-md overflow-hidden bg-[#fffdf8]">
						{recentJobs.map((job) => (
							<div
								key={job._id}
								className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-3 items-start p-3 border-b border-[#dfd6c8]/70 last:border-0 hover:bg-[#f8f5ee]/40 transition-colors"
							>
								<span className="text-[11px] font-extrabold text-[#877d70] tracking-tight whitespace-nowrap">
									[{formatActivityTime(job.updatedAt)}]
								</span>
								<div className="grid gap-0.5 min-w-0">
									<strong className="text-xs font-extrabold capitalize text-[#24211d]">{formatJobTypeLabel(job.type)}</strong>
									<small className="text-xs text-[#5f584f]">
										{job.error?.message || job.progress?.message || formatJobStatusLabel(job.status)}
									</small>
								</div>
								<span className="md:ml-auto">
									<Badge
										className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border border-solid ${
											getJobBadgeVariant(job.status) === "completed"
												? "bg-[#ecf8ef] text-[#207346] border-[#c7e8d0]"
												: getJobBadgeVariant(job.status) === "processing"
													? "bg-[#e9eef8] text-[#31517d] border-[#c8d5eb] animate-pulse"
													: getJobBadgeVariant(job.status) === "hold"
														? "bg-[#fff5df] text-[#9b5a10] border-[#f2d7a5]"
														: "bg-[#fff0ee] text-[#a73b2f] border-[#f3c7bf]"
										}`}
									>
										{formatJobStatusLabel(job.status)}
									</Badge>
								</span>
							</div>
						))}
					</div>
				) : (
					<p className="text-xs text-[#877d70] italic">No recent admin activity for this book yet.</p>
				)}
			</section>
		</Card>
	);
}

// --- Table of Contents Listing Card ---
interface TOCProps {
	book: Book;
	units: Omit<BookContent, "content">[];
	sortedItems: CatalogItem[];
	unitSearch: string;
	unitSort: "asc" | "desc";
	onSearchChange: (val: string) => void;
	onSortToggle: () => void;
}

function TableOfContents({ book, units, sortedItems, unitSearch, unitSort, onSearchChange, onSortToggle }: TOCProps) {
	return (
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dfd6c8] pb-3">
				<div>
					<h2 className="text-base font-bold text-[#24211d]">Table of Contents</h2>
					<p className="text-xs text-[#5f584f] mt-0.5">
						Archived translated: {units.length} / {book.translatedUnitsTotal || sortedItems.length || "?"} units.
					</p>
				</div>
				<div className="flex gap-2 items-center">
					<input
						type="text"
						placeholder="Search units..."
						value={unitSearch}
						onChange={(e) => onSearchChange(e.target.value)}
						className="w-40 h-8 bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-2.5 text-xs outline-none transition-all duration-150 focus:bg-white focus:border-[#405f8f] focus:ring-4 focus:ring-[#405f8f]/10"
					/>
					<Button
						variant="secondary"
						size="sm"
						onClick={onSortToggle}
						className="h-8 text-xs font-semibold px-2.5 border-[#dfd6c8] hover:bg-slate-50"
					>
						{unitSort === "asc" ? "oldest" : "newest"}
					</Button>
				</div>
			</div>

			{sortedItems.length === 0 ? (
				<p className="text-sm text-[#5f584f] mt-2">
					{units.length === 0 ? (
						<span>
							No translated units have been indexed yet.
							{book.sourceUrl && (
								<>
									{" "}
									<a href={book.sourceUrl} target="_blank" rel="noreferrer" className="text-[#405f8f] hover:underline font-bold">
										Open source page
									</a>
									.
								</>
							)}
						</span>
					) : (
						"No units match your search."
					)}
				</p>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[520px] overflow-y-auto pr-1">
						{sortedItems.slice(0, 120).map((unitItem) => (
							<Link
								key={unitItem.unitNumber}
								href={`/books/${book._id}/reader/${unitItem.unitNumber}`}
								className={`grid gap-1 p-3 border border-[#dfd6c8] rounded-md transition-all duration-150 ${
									unitItem.archived
										? "bg-[#f8f5ee] hover:bg-white hover:border-[#b9aa95]"
										: "bg-[#ece5d8]/40 hover:bg-[#f8f5ee] opacity-75 hover:opacity-100"
								}`}
							>
								<span className="text-[10px] font-black text-[#877d70] uppercase">Unit {unitItem.unitNumber}</span>
								<strong className="text-xs font-bold text-[#24211d] truncate">{unitItem.title}</strong>
								{!unitItem.archived && <small className="text-[9px] font-semibold text-[#877d70] uppercase">Indexed only</small>}
							</Link>
						))}
					</div>
					{sortedItems.length > 120 && (
						<p className="text-xs text-[#877d70] text-center mt-3 border-t border-slate-100 pt-3">
							Showing first 120 units. Use the search box above to locate specific numbers.
						</p>
					)}
				</>
			)}
		</Card>
	);
}

// --- Raw Table of Contents ---
interface RawTOCProps {
	book: Book;
	rawUnits: Omit<BookContent, "content">[];
	sortedRawItems: CatalogItem[];
	unitSearch: string;
	unitSort: "asc" | "desc";
	firstReadableRawUnit: number;
	onSearchChange: (val: string) => void;
	onSortToggle: () => void;
}

function RawTableOfContents({
	book,
	rawUnits,
	sortedRawItems,
	unitSearch,
	unitSort,
	firstReadableRawUnit,
	onSearchChange,
	onSortToggle,
}: RawTOCProps) {
	return (
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dfd6c8] pb-3">
				<div>
					<h2 className="text-base font-bold text-[#24211d]">Raw Table of Contents</h2>
					<p className="text-xs text-[#5f584f] mt-0.5">
						Archived raw: {rawUnits.length} / {book.rawUnitsTotal || sortedRawItems.length} units.
					</p>
				</div>
				<div className="flex gap-2 items-center flex-wrap">
					{sortedRawItems.length > 0 && (
						<>
							<input
								type="text"
								placeholder="Search raw..."
								value={unitSearch}
								onChange={(e) => onSearchChange(e.target.value)}
								className="w-40 h-8 bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-2.5 text-xs outline-none transition-all duration-150 focus:bg-white focus:border-[#405f8f] focus:ring-4 focus:ring-[#405f8f]/10"
							/>
							<Button
								variant="secondary"
								size="sm"
								onClick={onSortToggle}
								className="h-8 text-xs font-semibold px-2.5 border-[#dfd6c8] hover:bg-slate-50"
							>
								{unitSort === "asc" ? "oldest" : "newest"}
							</Button>
						</>
					)}
					{sortedRawItems.length > 0 && (
						<Button asChild variant="secondary" size="sm" className="h-8 text-xs font-semibold">
							<Link href={`/books/${book._id}/reader/${firstReadableRawUnit}?source=raw`}>Open Raw Reader</Link>
						</Button>
					)}
				</div>
			</div>

			{sortedRawItems.length === 0 ? (
				<p className="text-sm text-[#5f584f] mt-2">
					{sortedRawItems.length === 0 ? "No raw units have been indexed yet." : "No raw units match your search."}
				</p>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[520px] overflow-y-auto pr-1">
						{sortedRawItems.slice(0, 120).map((unitItem) => (
							<Link
								key={unitItem.unitNumber}
								href={`/books/${book._id}/reader/${unitItem.unitNumber}?source=raw`}
								className={`grid gap-1 p-3 border border-[#dfd6c8] rounded-md transition-all duration-150 ${
									unitItem.archived
										? "bg-[#f8f5ee] hover:bg-white hover:border-[#b9aa95]"
										: "bg-[#ece5d8]/40 hover:bg-[#f8f5ee] opacity-75 hover:opacity-100"
								}`}
							>
								<span className="text-[10px] font-black text-[#877d70] uppercase">Raw {unitItem.unitNumber}</span>
								<strong className="text-xs font-bold text-[#24211d] truncate">{unitItem.title}</strong>
								{!unitItem.archived && <small className="text-[9px] font-semibold text-[#877d70] uppercase">Indexed only</small>}
							</Link>
						))}
					</div>
					{sortedRawItems.length > 120 && (
						<p className="text-xs text-[#877d70] text-center mt-3 border-t border-slate-100 pt-3">
							Showing first 120 raw units. Use the search box to locate specific numbers.
						</p>
					)}
				</>
			)}
		</Card>
	);
}

// --- Sidebar detailing metadata and other genres ---
interface SidebarProps {
	book: Book;
	unitsCount: number;
	sortedItemsCount: number;
}

function DetailsSidebar({ book, unitsCount, sortedItemsCount }: SidebarProps) {
	const { user } = useAuth();
	const { showToast } = useToast();
	const [reportReason, setReportReason] = useState("inappropriate_content");
	const [reportDescription, setReportDescription] = useState("");
	const [reporting, setReporting] = useState(false);

	const reportReasons = [
		{ key: "inappropriate_content", label: "Inappropriate content" },
		{ key: "spam", label: "Spam" },
		{ key: "copyright", label: "Copyright" },
		{ key: "incorrect_metadata", label: "Incorrect metadata" },
		{ key: "other", label: "Other" },
	];

	async function handleReport() {
		if (!user) return;
		setReporting(true);
		try {
			await api.createReport(book._id, reportReason, reportDescription);
			showToast({ message: "Report submitted.", variant: "success" });
			setReportDescription("");
		} catch (err) {
			showToast({ message: err instanceof Error ? err.message : "Failed to submit report.", variant: "error" });
		} finally {
			setReporting(false);
		}
	}

	return (
		<aside className="flex flex-col gap-5">
			<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-4">
				<h2 className="text-sm font-extrabold text-[#24211d] uppercase border-b border-[#dfd6c8] pb-1.5">Details</h2>
				<dl className="grid gap-4 text-xs">
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Publication</dt>
						<dd className="text-xs font-bold text-[#24211d]">{book.publicationStatus || "Unknown"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Original source</dt>
						<dd className="text-xs font-bold text-[#24211d] truncate">
							{book.originalSource ? (
								<a href={book.originalSource} target="_blank" rel="noreferrer" className="text-[#405f8f] hover:underline">
									{book.originalSource}
								</a>
							) : (
								"Unknown"
							)}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Language</dt>
						<dd className="text-xs font-bold text-[#24211d]">{book.rawOriginalLanguage || "Translated"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Archived units</dt>
						<dd className="text-xs font-bold text-[#24211d]">
							{unitsCount} / {book.translatedUnitsTotal || sortedItemsCount || "?"}
						</dd>
					</div>
					{book.alternativeNames && book.alternativeNames.length > 0 && (
						<div className="grid gap-0.5">
							<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Alternative names</dt>
							<dd className="text-xs font-medium text-[#5f584f] leading-relaxed">{book.alternativeNames.join(", ")}</dd>
						</div>
					)}
				</dl>
			</Card>

			<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-4">
				<h2 className="text-sm font-extrabold text-[#24211d] uppercase border-b border-[#dfd6c8] pb-1.5">Genres</h2>
				<div className="flex flex-wrap gap-1.5">
					{!book.genres || book.genres.length === 0 ? (
						<span className="text-xs text-[#5f584f] italic">No genres indexed.</span>
					) : (
						book.genres.map((genre) => (
							<Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
								<Badge className="bg-[#fffdf8] border-[#dfd6c8] text-[#5d6474] hover:bg-[#f8f5ee] font-bold text-[10px] uppercase tracking-wider py-1">
									{genre}
								</Badge>
							</Link>
						))
					)}
				</div>
			</Card>

			{user && (
				<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
					<h2 className="text-sm font-extrabold text-[#24211d] uppercase border-b border-[#dfd6c8] pb-1.5">Report</h2>
					<div className="flex flex-col gap-2.5">
						<select
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none focus:border-[#405f8f] focus:ring-2 focus:ring-[#405f8f]/10"
							value={reportReason}
							onChange={(e) => setReportReason(e.target.value)}
						>
							{reportReasons.map((r) => (
								<option key={r.key} value={r.key}>
									{r.label}
								</option>
							))}
						</select>
						<textarea
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none focus:border-[#405f8f] focus:ring-2 focus:ring-[#405f8f]/10"
							rows={3}
							placeholder="Optional details..."
							value={reportDescription}
							onChange={(e) => setReportDescription(e.target.value)}
						/>
						<Button
							variant="secondary"
							size="sm"
							onClick={handleReport}
							disabled={reporting}
							className="h-8 font-semibold text-xs"
						>
							{reporting ? (
								<div className="w-4 h-4 border-2 border-slate-300 border-t-[#405f8f] rounded-full animate-spin" />
							) : (
								"Submit Report"
							)}
						</Button>
					</div>
				</Card>
			)}
		</aside>
	);
}

// ==========================================
// MAIN DEFAULT EXPORT COMPONENT
// ==========================================

export default function PublicBookDetails({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const { user, hasCapability } = useAuth();
	const { showToast } = useToast();

	// Page & Core UI Data States
	const [book, setBook] = useState<Book | null>(null);
	const [units, setUnits] = useState<Omit<BookContent, "content">[]>([]);
	const [rawUnits, setRawUnits] = useState<Omit<BookContent, "content">[]>([]);
	const [authorBooks, setAuthorBooks] = useState<Book[]>([]);
	const [jobs, setJobs] = useState<BackgroundJob[]>([]);
	const [reviews, setReviews] = useState<BookReview[]>([]);
	const [loading, setLoading] = useState(true);
	const [isUserBook, setIsUserBook] = useState(false);
	const [voting, setVoting] = useState(false);
	const [voted, setVoted] = useState(false);

	// Action & Processing state machines
	const [jobsLoading, setJobsLoading] = useState(false);
	const [adding, setAdding] = useState(false);
	const [queueing, setQueueing] = useState<JobType | null>(null);
	const [runningNow, setRunningNow] = useState<JobType | null>(null);
	const [addMessage, setAddMessage] = useState("");
	const [adminMessage, setAdminMessage] = useState("");

	// Catalog Edit States
	const [isEditCatalogOpen, setIsEditCatalogOpen] = useState(false);
	const [editingCatalog, setEditingCatalog] = useState(false);
	const [editTitle, setEditTitle] = useState("");
	const [editAuthor, setEditAuthor] = useState("");
	const [editAuthorPenName, setEditAuthorPenName] = useState("");
	const [editAuthorRealName, setEditAuthorRealName] = useState("");
	const [editAlternativeNames, setEditAlternativeNames] = useState("");
	const [editGenres, setEditGenres] = useState("");
	const [editOriginalSource, setEditOriginalSource] = useState("");
	const [editPublicationStatus, setEditPublicationStatus] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editCoverUrl, setEditCoverUrl] = useState("");
	const [editSourceUrl, setEditSourceUrl] = useState("");
	const [editRawSourceUrl, setEditRawSourceUrl] = useState("");
	const [editRawOriginalLanguage, setEditRawOriginalLanguage] = useState("");

	// HTML Import Portal States
	const [isIndexHtmlModalOpen, setIsIndexHtmlModalOpen] = useState(false);
	const [indexHtmlSourceKind, setIndexHtmlSourceKind] = useState<SourceKind>("raw");
	const [indexHtmlPageUrl, setIndexHtmlPageUrl] = useState("");
	const [indexHtmlContent, setIndexHtmlContent] = useState("");
	const [importingIndexHtml, setImportingIndexHtml] = useState(false);

	// Client View Configurations
	const [activeTab, setActiveTab] = useState<"read" | "admin" | "library">("read");
	const [unitSearch, setUnitSearch] = useState("");
	const [unitSort, setUnitSort] = useState<"asc" | "desc">("asc");

	const fetchBookJobs = async () => {
		if (!hasCapability(CAPABILITY.JOBS_LIST)) return;
		setJobsLoading(true);
		try {
			const jobData = await api.getBookJobs(id);
			setJobs(jobData);
		} catch (err) {
			console.error("Failed to load book jobs:", err);
		} finally {
			setJobsLoading(false);
		}
	};

	const refreshUnitLists = async () => {
		const [unitData, rawUnitData] = await Promise.all([api.getPublicUnits(id).catch(() => []), api.getPublicRawUnits(id).catch(() => [])]);
		setUnits(unitData);
		setRawUnits(rawUnitData);
	};

	// --- Primary Data Fetch ---
	useEffect(() => {
		async function loadBook() {
			setLoading(true);
			try {
				let bookData: Book;
				let userBook = false;
				if (user) {
					try {
						bookData = await api.getBook(id);
						userBook = true;
					} catch (err: any) {
						if (err.status === 404) {
							bookData = await api.getPublicBook(id);
						} else {
							throw err;
						}
					}
				} else {
					bookData = await api.getPublicBook(id);
				}
				const [unitData, rawUnitData, authorData, reviewsData] = await Promise.all([
					api.getPublicUnits(id).catch(() => []),
					api.getPublicRawUnits(id).catch(() => []),
					bookData.authorId ? api.getPublicAuthor(bookData.authorId).catch(() => null) : Promise.resolve(null),
					api.getBookReviews(id).catch(() => ({ reviews: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } })),
				]);
				setBook(bookData);
				setIsUserBook(userBook);
				setUnits(unitData);
				setRawUnits(rawUnitData);
				setAuthorBooks((authorData?.books || []).filter((item) => item._id !== bookData._id).slice(0, 6));
				setReviews(reviewsData.reviews || []);
			} catch (err) {
				console.error("Failed to load public book:", err);
			} finally {
				setLoading(false);
			}
		}
		loadBook();
	}, [id, user]);

	const openCatalogEditor = () => {
		if (!book) return;
		setEditTitle(book.title || "");
		setEditAuthor(book.author || "");
		setEditAuthorPenName(book.authorPenName || "");
		setEditAuthorRealName(book.authorRealName || "");
		setEditAlternativeNames((book.alternativeNames || []).join(", "));
		setEditGenres((book.genres || []).join(", "));
		setEditOriginalSource(book.originalSource || "");
		setEditPublicationStatus(book.publicationStatus || "");
		setEditDescription(book.description || "");
		setEditCoverUrl(book.coverUrl || "");
		setEditSourceUrl(book.sourceUrl || "");
		setEditRawSourceUrl(book.rawSourceUrl || "");
		setEditRawOriginalLanguage(book.rawOriginalLanguage || "");
		setIsEditCatalogOpen(true);
	};

	useEffect(() => {
		if (!hasCapability(CAPABILITY.JOBS_LIST)) return;
		let cancelled = false;

		async function loadBookJobs() {
			setJobsLoading(true);
			try {
				const jobData = await api.getBookJobs(id);
				if (!cancelled) setJobs(jobData);
			} catch (err) {
				if (!cancelled) console.error("Failed to load book jobs:", err);
			} finally {
				if (!cancelled) setJobsLoading(false);
			}
		}

		void loadBookJobs();
		return () => {
			cancelled = true;
		};
	}, [id, user?.capabilities, hasCapability]);

	const firstReadableUnit = useMemo(() => units[0]?.unitNumber || 1, [units]);

	// Catalog items builders
	const rawCatalogItems = useMemo(() => {
		if (!book) return [];
		const archivedByNumber = new Map(rawUnits.map((unit) => [unit.unitNumber, unit]));
		const seen = new Set<number>();
		const indexedItems: CatalogItem[] = [];
		for (const unit of book.rawUnitsList || []) {
			if (!Number.isFinite(unit.unitNumber) || seen.has(unit.unitNumber)) continue;
			seen.add(unit.unitNumber);
			const archived = archivedByNumber.get(unit.unitNumber);
			const archivedTitle = archived?.title?.trim() || "";
			const indexedTitle = unit.title?.trim() || "";
			indexedItems.push({
				unitNumber: unit.unitNumber,
				title:
					archivedTitle && !isGenericUnitTitle(archivedTitle, book.title, unit.unitNumber)
						? archivedTitle
						: indexedTitle || archivedTitle || `Raw Unit ${unit.unitNumber}`,
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || unit.url,
				scrapedAt: archived?.scrapedAt,
			});
		}

		const archivedOnlyItems = Array.from(archivedByNumber.values())
			.filter((unit) => !seen.has(unit.unitNumber))
			.map((unit) => ({
				unitNumber: unit.unitNumber,
				title: unit.title || `Raw Unit ${unit.unitNumber}`,
				archived: true,
				sourceUrl: unit.sourceUrl,
				scrapedAt: unit.scrapedAt,
			}));

		return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.unitNumber - b.unitNumber);
	}, [book, rawUnits]);

	const translatedCatalogItems = useMemo(() => {
		if (!book) return [];
		const archivedByNumber = new Map(units.map((unit) => [unit.unitNumber, unit]));
		const seen = new Set<number>();
		const indexedItems: CatalogItem[] = [];
		for (const unit of book.translatedUnitsList || []) {
			if (!Number.isFinite(unit.unitNumber) || seen.has(unit.unitNumber)) continue;
			seen.add(unit.unitNumber);
			const archived = archivedByNumber.get(unit.unitNumber);
			const archivedTitle = archived?.title?.trim() || "";
			const indexedTitle = unit.title?.trim() || "";
			indexedItems.push({
				unitNumber: unit.unitNumber,
				title:
					archivedTitle && !isGenericUnitTitle(archivedTitle, book.title, unit.unitNumber)
						? archivedTitle
						: indexedTitle || archivedTitle || `Unit ${unit.unitNumber}`,
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || unit.url,
				scrapedAt: archived?.scrapedAt,
			});
		}

		const archivedOnlyItems = Array.from(archivedByNumber.values())
			.filter((unit) => !seen.has(unit.unitNumber))
			.map((unit) => ({
				unitNumber: unit.unitNumber,
				title: unit.title || `Unit ${unit.unitNumber}`,
				archived: true,
				sourceUrl: unit.sourceUrl,
				scrapedAt: unit.scrapedAt,
			}));

		return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.unitNumber - b.unitNumber);
	}, [book, units]);

	const firstReadableRawUnit = useMemo(() => rawCatalogItems[0]?.unitNumber || rawUnits[0]?.unitNumber || 1, [rawCatalogItems, rawUnits]);

	// Sorting and filtering datasets
	const sortedTranslatedItems = useMemo(() => {
		let items = [...translatedCatalogItems];
		if (unitSearch.trim()) {
			const searchLower = unitSearch.toLowerCase();
			items = items.filter((item) => item.unitNumber.toString().includes(searchLower) || item.title.toLowerCase().includes(searchLower));
		}
		if (unitSort === "desc") {
			items.reverse();
		}
		return items;
	}, [translatedCatalogItems, unitSearch, unitSort]);

	const sortedRawItems = useMemo(() => {
		let items = [...rawCatalogItems];
		if (unitSearch.trim()) {
			const searchLower = unitSearch.toLowerCase();
			items = items.filter((item) => item.unitNumber.toString().includes(searchLower) || item.title.toLowerCase().includes(searchLower));
		}
		if (unitSort === "desc") {
			items.reverse();
		}
		return items;
	}, [rawCatalogItems, unitSearch, unitSort]);

	const coverSrc = book ? getBookCoverUrl(book) : "";
	const canManageCatalog = hasCapability(CAPABILITY.BOOKS_MANAGE) || hasCapability(CAPABILITY.BOOKS_CREATE) || hasCapability(CAPABILITY.BOOKS_UPDATE);
	const canReadJobs = hasCapability(CAPABILITY.JOBS_LIST);
	const canScrape = hasCapability(CAPABILITY.JOBS_SCRAPE);
	const canImport = hasCapability(CAPABILITY.JOBS_IMPORT);
	const canAdmin = canManageCatalog || canReadJobs || canScrape || canImport;
	const activeJobTypes = useMemo(() => new Set(jobs.filter((job) => job.status === "pending" || job.status === "processing").map((job) => job.type)), [jobs]);
	const processingJobCount = jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
	const translatedUnitTotal = book?.translatedUnitsTotal || translatedCatalogItems.length || 0;
	const translatedArchivePercent = translatedUnitTotal ? Math.min(100, Math.round((units.length / translatedUnitTotal) * 100)) : 0;

	const translatedPipelineSections = canScrape || canImport ? [
		{
			key: "translated-indexing",
			title: "Indexing",
			actions: [
				{
					key: "scrape_metadata-queue",
					label: "Queue translated index",
					tone: "translated",
					disabled: !canScrape || !book?.sourceUrl || Boolean(queueing) || activeJobTypes.has("scrape_metadata"),
					busy: queueing === "scrape_metadata",
					onClick: () => handleTriggerScrape("scrape_metadata"),
				},
				{
					key: "scrape_metadata-now",
					label: "Index translated now",
					tone: "raw",
					disabled: !canScrape || !book?.sourceUrl || Boolean(runningNow),
					busy: runningNow === "scrape_metadata",
					onClick: () => handleRunScrapeNow("scrape_metadata"),
				},
			],
		},
		{
			key: "translated-archiving",
			title: "Archiving",
			actions: [
				{
					key: "scrape_units-queue",
					label: "Queue translated archive",
					tone: "translated",
					disabled: !canScrape || !(book?.translatedUnitsList || []).length || Boolean(queueing) || activeJobTypes.has("scrape_units"),
					busy: queueing === "scrape_units",
					onClick: () => handleTriggerScrape("scrape_units"),
				},
				{
					key: "scrape_units-now",
					label: "Archive next 5 translated",
					tone: "success",
					disabled: !canScrape || translatedCatalogItems.length === 0 || Boolean(runningNow),
					busy: runningNow === "scrape_units",
					onClick: () => handleRunScrapeNow("scrape_units"),
				},
			],
		},
		{
			key: "translated-html",
			title: "HTML import",
			actions: [
				{
					key: "translated-import-html",
					label: "Import translated index HTML",
					tone: "translated",
					disabled: !canImport || !book?.sourceUrl,
					busy: false,
					onClick: () => openIndexHtmlImport("translated"),
				},
			],
		},
	] : [];

	const rawPipelineSections = canScrape || canImport ? [
		{
			key: "raw-indexing",
			title: "Indexing",
			actions: [
				{
					key: "scrape_raw_metadata-queue",
					label: "Queue raw index",
					tone: "raw",
					disabled: !canScrape || !book?.rawSourceUrl || Boolean(queueing) || activeJobTypes.has("scrape_raw_metadata"),
					busy: queueing === "scrape_raw_metadata",
					onClick: () => handleTriggerScrape("scrape_raw_metadata"),
				},
				{
					key: "scrape_raw_metadata-now",
					label: "Index raw now",
					tone: "raw",
					disabled: !canScrape || !book?.rawSourceUrl || Boolean(runningNow),
					busy: runningNow === "scrape_raw_metadata",
					onClick: () => handleRunScrapeNow("scrape_raw_metadata"),
				},
			],
		},
		{
			key: "raw-archiving",
			title: "Archiving",
			actions: [
				{
					key: "scrape_raw_units-queue",
					label: "Queue raw archive",
					tone: "raw",
					disabled: !canScrape || rawCatalogItems.length === 0 || Boolean(queueing) || activeJobTypes.has("scrape_raw_units"),
					busy: queueing === "scrape_raw_units",
					onClick: () => handleTriggerScrape("scrape_raw_units"),
				},
				{
					key: "scrape_raw_units-now",
					label: "Archive next 5 raw",
					tone: "success",
					disabled: !canScrape || rawCatalogItems.length === 0 || Boolean(runningNow),
					busy: runningNow === "scrape_raw_units",
					onClick: () => handleRunScrapeNow("scrape_raw_units"),
				},
			],
		},
		{
			key: "raw-html",
			title: "HTML import",
			actions: [
				{
					key: "raw-import-html",
					label: "Import raw index HTML",
					tone: "raw",
					disabled: !canImport || !book?.rawSourceUrl,
					busy: false,
					onClick: () => openIndexHtmlImport("raw"),
				},
			],
		},
	] : [];

	const commonAdminActions = [
		{
			key: "edit-catalog",
			label: "Edit Book Details",
			tone: "neutral",
			disabled: !canManageCatalog,
			onClick: openCatalogEditor,
		},
		book?.sourceUrl
			? {
					key: "open-translated-source",
					label: "Open Source Page",
					tone: "neutral",
					disabled: false,
					href: book.sourceUrl,
				}
			: null,
		book?.rawSourceUrl
			? {
					key: "open-raw-source",
					label: "Open Raw Source",
					tone: "neutral",
					disabled: false,
					href: book.rawSourceUrl,
				}
			: null,
		{
			key: "refresh-jobs",
			label: jobsLoading ? "Refreshing jobs..." : "Refresh Log Jobs",
			tone: "neutral",
			disabled: !canReadJobs || jobsLoading,
			onClick: fetchBookJobs,
		},
	].filter((action): action is CommonAdminAction => action !== null);

	// --- Handlers ---
	const handleAddToLibrary = async () => {
		if (!book || !user) return;
		setAdding(true);
		setAddMessage("");
		try {
			const created = await api.addBookToLibrary(book._id);
			setAddMessage("Added to your profile library.");
			window.setTimeout(() => {
				window.location.href = `/books/${created._id}`;
			}, 700);
		} catch (err: unknown) {
			setAddMessage(err instanceof Error ? err.message : "Could not add this book.");
		} finally {
			setAdding(false);
		}
	};

	const handleVote = async () => {
		if (!book || !user) return;
		setVoting(true);
		try {
			const result = await api.voteBook(book._id);
			setBook((prev) => (prev ? { ...prev, totalVotes: result.totalVotes } : prev));
			setVoted(result.voted);
		} catch (err) {
			console.error("Failed to vote for book:", err);
		} finally {
			setVoting(false);
		}
	};

	const handleTriggerScrape = async (type: JobType) => {
		if (!book) return;
		setQueueing(type);
		setAdminMessage("");
		try {
			const result = await api.triggerScrape(book._id, type);
			setAdminMessage(result.message || "Scraper job queued.");
			await fetchBookJobs();
		} catch (err: unknown) {
			setAdminMessage(err instanceof Error ? err.message : "Could not queue scraper job.");
		} finally {
			setQueueing(null);
		}
	};

	const handleRunScrapeNow = async (type: JobType) => {
		if (!book) return;
		setRunningNow(type);
		setAdminMessage("");
		try {
			const result = await api.runScrapeNow(book._id, type, { limit: 5 });
			setBook(result.book);
			await refreshUnitLists();
			setAdminMessage(result.message || "Direct scraper run completed.");
			await fetchBookJobs();
		} catch (err: unknown) {
			setAdminMessage(err instanceof Error ? err.message : "Direct scraper run failed.");
			await fetchBookJobs();
		} finally {
			setRunningNow(null);
		}
	};

	const openIndexHtmlImport = (sourceKind: SourceKind) => {
		if (!book) return;
		setIndexHtmlSourceKind(sourceKind);
		setIndexHtmlPageUrl(sourceKind === "raw" ? book.rawSourceUrl || "" : book.sourceUrl || "");
		setIndexHtmlContent("");
		setIsIndexHtmlModalOpen(true);
	};

	const handleImportIndexHtml = async (event: FormEvent) => {
		event.preventDefault();
		if (!book) return;
		setImportingIndexHtml(true);
		setAdminMessage("");
		try {
			const result = await api.importHtmlIndex(book._id, {
				sourceKind: indexHtmlSourceKind,
				html: indexHtmlContent,
				pageUrl: indexHtmlPageUrl || (indexHtmlSourceKind === "raw" ? book.rawSourceUrl : book.sourceUrl),
			});
			setBook(result.book);
			await refreshUnitLists();
			setAdminMessage(result.message);
			setIsIndexHtmlModalOpen(false);
			setIndexHtmlContent("");
			setIndexHtmlPageUrl("");
			await fetchBookJobs();
		} catch (err: unknown) {
			setAdminMessage(err instanceof Error ? err.message : "Could not import catalogue HTML.");
		} finally {
			setImportingIndexHtml(false);
		}
	};

	if (loading) {
		return (
			<div className="w-full max-w-[1520px] mx-auto px-5 py-8">
				<Card className="p-12 text-center flex flex-col items-center justify-center border-[#dfd6c8] bg-[#fffdf8]">
					<div className="w-10 h-10 border-4 border-slate-200 border-t-[#405f8f] rounded-full animate-spin" />
				</Card>
			</div>
		);
	}

	if (!book) {
		return (
			<div className="w-full max-w-[1520px] mx-auto px-5 py-8">
				<Card className="p-12 text-center border-[#dfd6c8] bg-[#fffdf8]">
					<h1 className="text-xl font-extrabold text-[#24211d]">Book Not Found</h1>
					<Button asChild variant="secondary" className="mt-4 text-xs font-bold border-[#dfd6c8] hover:bg-slate-50">
						<Link href="/">Back Home</Link>
					</Button>
				</Card>
			</div>
		);
	}

	return (
		<div className="w-full max-w-[1520px] mx-auto px-4 md:px-5 py-6 md:py-8 flex flex-col gap-6">
			{/* Book Hero block */}
			<BookHero
				book={book}
				unitsCount={units.length}
				rawCatalogCount={rawCatalogItems.length}
				coverSrc={coverSrc}
				user={user}
				adding={adding}
				addMessage={addMessage}
				firstReadableUnit={firstReadableUnit}
				firstReadableRawUnit={firstReadableRawUnit}
				onAddToLibrary={handleAddToLibrary}
				voting={voting}
				voted={voted}
				onVote={handleVote}
			/>

			{/* Custom Segmented Tabs (replaces old .detail-tabs) */}
			{(canAdmin || isUserBook) && (
				<div className="flex gap-6 border-b-2 border-[#dfd6c8] mt-2 pb-0.5">
					<button
						className={`relative pb-2.5 text-sm font-bold transition-all ${
							activeTab === "read"
								? "text-[#405f8f] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[3px] after:bg-[#405f8f] after:rounded-full"
								: "text-[#877d70] hover:text-[#24211d]"
						}`}
						onClick={() => setActiveTab("read")}
					>
						📖 Reader View
					</button>
					{isUserBook && (
						<button
							className={`relative pb-2.5 text-sm font-bold transition-all ${
								activeTab === "library"
									? "text-[#405f8f] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[3px] after:bg-[#405f8f] after:rounded-full"
									: "text-[#877d70] hover:text-[#24211d]"
							}`}
							onClick={() => setActiveTab("library")}
						>
							🗂️ My Library
						</button>
					)}
					{canAdmin && (
						<button
							className={`relative pb-2.5 text-sm font-bold transition-all ${
								activeTab === "admin"
									? "text-[#405f8f] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[3px] after:bg-[#405f8f] after:rounded-full"
									: "text-[#877d70] hover:text-[#24211d]"
							}`}
							onClick={() => setActiveTab("admin")}
						>
							⚡ Scraper & Admin Tools
						</button>
					)}
				</div>
			)}

			{/* Scraper / Admin Board view */}
			{canAdmin && activeTab === "admin" && (
				<AdminConsole
					book={book}
					jobs={jobs}
					activeJobTypes={activeJobTypes}
					processingJobCount={processingJobCount}
					translatedArchivePercent={translatedArchivePercent}
					translatedPipelineSections={translatedPipelineSections}
					rawPipelineSections={rawPipelineSections}
					commonAdminActions={commonAdminActions}
					adminMessage={adminMessage}
				/>
			)}

			{/* Library view for users tracking this book */}
			{isUserBook && activeTab === "library" && book && (
				<BookLibraryPanel
					bookId={id}
					book={book}
					units={units}
					onUpdate={(updated) => setBook(updated)}
				/>
			)}

			{/* Reader view standard layout */}
			{activeTab === "read" && (
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
					<main className="flex flex-col gap-6">
						{/* Summary Block */}
						<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
							<h2 className="text-base font-bold text-[#24211d]">Book Summary</h2>
							<p className="text-sm leading-relaxed whitespace-pre-line text-[#5f584f]">
								{book.description || "No summary has been indexed for this book yet."}
							</p>
						</Card>

						{/* Author Books slider block */}
						{/* Author Books slider block */}
						{authorBooks.length > 0 && (
							<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
								<h2 className="text-sm font-extrabold uppercase tracking-wider text-[#24211d]">Author&apos;s Other Books</h2>
								<div className="flex flex-col border border-[#dfd6c8] rounded-md overflow-hidden bg-[#fffdf8]">
									{authorBooks.map((item) => {
										return (
											<Link
												key={item._id}
												href={`/books/${item._id}`}
												className="flex gap-3.5 p-3 border-b border-[#dfd6c8]/60 last:border-b-0 hover:bg-[#f8f5ee]/50 transition-all group"
											>
												{/* Book Thumb Cover */}
												<div className="w-[48px] h-[64px] bg-[#f8f5ee] border border-[#dfd6c8] rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
													{item.coverUrl ? (
														<Image
															src={item.coverUrl}
															alt={item.title}
															width={48}
															height={64}
															unoptimized
															className="w-full h-full object-cover transition-transform group-hover:scale-105"
														/>
													) : (
														<span className="text-xs font-black text-[#405f8f] opacity-40">
															{item.title.slice(0, 2).toUpperCase()}
														</span>
													)}
												</div>

												{/* Title & Metadata Panel */}
												<div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
													<strong className="text-sm font-bold text-[#24211d] truncate group-hover:text-[#405f8f] transition-colors">
														{item.title}
													</strong>

													{/* Metadata Sub-row */}
													<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5f584f]">
														<span className="font-semibold text-[#b65f3d]">{item.translatedUnitsTotal || 0} units</span>

														{item.publicationStatus && (
															<>
																<span className="text-[#dfd6c8]">•</span>
																<span className="bg-[#f8f5ee] border border-[#dfd6c8] px-1.5 py-0.5 rounded text-[10px] font-medium text-[#5f584f]">
																	{item.publicationStatus}
																</span>
															</>
														)}

														{item.genres && item.genres.length > 0 && (
															<>
																<span className="text-[#dfd6c8]">•</span>
																<span className="truncate max-w-[180px] text-[#877d70]">
																	{item.genres.slice(0, 2).join(", ")}
																</span>
															</>
														)}
													</div>
												</div>
											</Link>
										);
									})}
								</div>
							</Card>
						)}

						{/* Reviews card */}
						{reviews.length > 0 && (
							<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
								<h2 className="text-base font-bold text-[#24211d]">Reviews ({reviews.length})</h2>
								<div className="flex flex-col gap-3">
									{reviews.slice(0, 5).map((review) => (
										<div key={review._id} className="border-b border-[#dfd6c8]/60 last:border-b-0 pb-3 last:pb-0">
											<div className="flex items-center justify-between gap-2">
												<strong className="text-sm font-bold text-[#24211d]">{review.username}</strong>
												<span className="text-[10px] text-[#877d70]">{new Date(review.createdAt).toLocaleDateString()}</span>
											</div>
											<p className="text-sm text-[#5f584f] mt-1 whitespace-pre-line">{review.review}</p>
										</div>
									))}
								</div>
							</Card>
						)}

						{/* Translated TOC card */}
						<TableOfContents
							book={book}
							units={units}
							sortedItems={sortedTranslatedItems}
							unitSearch={unitSearch}
							unitSort={unitSort}
							onSearchChange={setUnitSearch}
							onSortToggle={() => setUnitSort((prev) => (prev === "asc" ? "desc" : "asc"))}
						/>

						{/* Raw TOC card */}
						{(book.rawUnitsTotal > 0 || rawCatalogItems.length > 0) && (
							<RawTableOfContents
								book={book}
								rawUnits={rawUnits}
								sortedRawItems={sortedRawItems}
								unitSearch={unitSearch}
								unitSort={unitSort}
								firstReadableRawUnit={firstReadableRawUnit}
								onSearchChange={setUnitSearch}
								onSortToggle={() => setUnitSort((prev) => (prev === "asc" ? "desc" : "asc"))}
							/>
						)}
					</main>

					{/* Metadata layout sidebar */}
					<DetailsSidebar book={book} unitsCount={units.length} sortedItemsCount={translatedCatalogItems.length} />
				</div>
			)}

			{/* HTML import modal portal */}
			{isIndexHtmlModalOpen && canImport && (
				<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[6px]">
					<Card className="w-full max-w-[760px] p-5 flex flex-col gap-4 bg-[#fffdf8] border-[#dfd6c8] shadow-2xl overflow-auto max-h-[90vh]">
						<div className="flex justify-between items-center border-b border-[#dfd6c8] pb-2">
							<h2 className="text-lg font-bold text-[#24211d]">Import {indexHtmlSourceKind === "raw" ? "Raw" : "Translated"} Catalogue HTML</h2>
							<button
								onClick={() => setIsIndexHtmlModalOpen(false)}
								className="bg-transparent border-0 text-[#877d70] text-2xl cursor-pointer hover:text-[#24211d]"
							>
								&times;
							</button>
						</div>

						<form onSubmit={handleImportIndexHtml} className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Catalogue Page URL</label>
								<input
									type="url"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3.5 py-2.5 text-xs outline-none transition-all duration-150 focus:bg-white focus:border-[#405f8f] focus:ring-4 focus:ring-[#405f8f]/10"
									value={indexHtmlPageUrl}
									onChange={(event) => setIndexHtmlPageUrl(event.target.value)}
									required
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Saved HTML Content</label>
								<textarea
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3.5 py-2.5 text-xs outline-none font-mono transition-all duration-150 focus:bg-white focus:border-[#405f8f] focus:ring-4 focus:ring-[#405f8f]/10"
									rows={12}
									value={indexHtmlContent}
									onChange={(event) => setIndexHtmlContent(event.target.value)}
									placeholder="<html>..."
									required
								/>
							</div>

							<div className="flex justify-end gap-2.5 border-t border-[#dfd6c8] pt-3.5 mt-2">
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onClick={() => setIsIndexHtmlModalOpen(false)}
									disabled={importingIndexHtml}
								>
									Cancel
								</Button>
								<Button type="submit" size="sm" className="bg-[#405f8f] hover:bg-[#304a72] text-white" disabled={importingIndexHtml}>
									{importingIndexHtml ? "Importing..." : "Import Index"}
								</Button>
							</div>
						</form>
					</Card>
				</div>
			)}

			{/* Edit metadata form config modal */}
			{isEditCatalogOpen && canManageCatalog && (
				<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[6px]">
					<Card className="w-full max-w-[760px] p-5 flex flex-col gap-4 bg-[#fffdf8] border-[#dfd6c8] shadow-2xl overflow-auto max-h-[90vh]">
						<div className="flex justify-between items-center border-b border-[#dfd6c8] pb-2">
							<h2 className="text-lg font-bold text-[#24211d]">Edit Catalog Metadata</h2>
							<button
								onClick={() => setIsEditCatalogOpen(false)}
								className="bg-transparent border-0 text-[#877d70] text-2xl cursor-pointer hover:text-[#24211d]"
							>
								&times;
							</button>
						</div>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								if (!book) return;
								setEditingCatalog(true);
								try {
									const updates: Partial<Book> = {
										title: editTitle,
										author: editAuthor,
										authorPenName: editAuthorPenName,
										authorRealName: editAuthorRealName,
										alternativeNames: editAlternativeNames
											.split(",")
											.map((s) => s.trim())
											.filter(Boolean),
										genres: editGenres
											.split(",")
											.map((s) => s.trim())
											.filter(Boolean),
										originalSource: editOriginalSource,
										publicationStatus: editPublicationStatus,
										description: editDescription,
										coverUrl: editCoverUrl,
										sourceUrl: editSourceUrl,
										rawSourceUrl: editRawSourceUrl,
										rawOriginalLanguage: editRawOriginalLanguage,
									};
									const updated = await api.updateCatalogBook(book._id, updates);
									setBook(updated);
									setIsEditCatalogOpen(false);
								} catch (err: unknown) {
									console.error("Failed to update catalog book:", err);
									showToast({ message: err instanceof Error ? err.message : "Failed to update catalog book.", variant: "error" });								} finally {
									setEditingCatalog(false);
								}
							}}
							className="flex flex-col gap-3"
						>
							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Title</label>
								<input
									type="text"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white focus:border-[#405f8f]"
									value={editTitle}
									onChange={(e) => setEditTitle(e.target.value)}
									required
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
								<div className="flex flex-col gap-1.5">
									<label className="text-xs font-bold text-[#5f584f]">Author</label>
									<input
										type="text"
										className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white focus:border-[#405f8f]"
										value={editAuthor}
										onChange={(e) => setEditAuthor(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<label className="text-xs font-bold text-[#5f584f]">Author Pen Name</label>
									<input
										type="text"
										className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white focus:border-[#405f8f]"
										value={editAuthorPenName}
										onChange={(e) => setEditAuthorPenName(e.target.value)}
									/>
								</div>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Author Real Name</label>
								<input
									type="text"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									value={editAuthorRealName}
									onChange={(e) => setEditAuthorRealName(e.target.value)}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Alternative Names (comma-separated)</label>
								<input
									type="text"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									value={editAlternativeNames}
									onChange={(e) => setEditAlternativeNames(e.target.value)}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Genres (comma-separated)</label>
								<input
									type="text"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									value={editGenres}
									onChange={(e) => setEditGenres(e.target.value)}
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
								<div className="flex flex-col gap-1.5">
									<label className="text-xs font-bold text-[#5f584f]">Publication Status</label>
									<input
										type="text"
										className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
										value={editPublicationStatus}
										onChange={(e) => setEditPublicationStatus(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<label className="text-xs font-bold text-[#5f584f]">Raw Original Language</label>
									<input
										type="text"
										className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
										value={editRawOriginalLanguage}
										onChange={(e) => setEditRawOriginalLanguage(e.target.value)}
									/>
								</div>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Original Source</label>
								<input
									type="url"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									value={editOriginalSource}
									onChange={(e) => setEditOriginalSource(e.target.value)}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Source URL</label>
								<input
									type="url"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									value={editSourceUrl}
									onChange={(e) => setEditSourceUrl(e.target.value)}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Raw Source URL</label>
								<input
									type="url"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									value={editRawSourceUrl}
									onChange={(e) => setEditRawSourceUrl(e.target.value)}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Cover URL</label>
								<input
									type="url"
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									value={editCoverUrl}
									onChange={(e) => setEditCoverUrl(e.target.value)}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-bold text-[#5f584f]">Description</label>
								<textarea
									className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
									rows={4}
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
								/>
							</div>

							<div className="flex justify-end gap-2.5 border-t border-[#dfd6c8] pt-3 mt-2">
								<Button type="button" variant="secondary" size="sm" onClick={() => setIsEditCatalogOpen(false)} disabled={editingCatalog}>
									Cancel
								</Button>
								<Button type="submit" size="sm" className="bg-[#405f8f] hover:bg-[#304a72] text-white" disabled={editingCatalog}>
									{editingCatalog ? "Saving..." : "Save Changes"}
								</Button>
							</div>
						</form>
					</Card>
				</div>
			)}
		</div>
	);
}
