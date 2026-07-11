"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, getNovelCoverUrl, type BackgroundJob, type ChapterContent, type JobType, type Novel, type SourceKind } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { CAPABILITY } from "../../../utils/permissions";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";

// ==========================================
// UTILS & HELPER FUNCTIONS
// ==========================================

function getAuthor(novel: Novel): string {
	return novel.authorPenName || novel.author || novel.authorRealName || "Unknown Author";
}

function normalizeTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isGenericChapterTitle(value: string, novelTitle: string, chapterNumber: number): boolean {
	const normalized = normalizeTitle(value);
	return !normalized || normalized === normalizeTitle(novelTitle) || normalized === `chapter ${chapterNumber}` || normalized === `ch ${chapterNumber}`;
}

function formatJobTypeLabel(type: JobType): string {
	const labels: Record<JobType, string> = {
		scrape_metadata: "Translated index",
		scrape_chapters: "Translated archive",
		scrape_raw_metadata: "Raw index",
		scrape_raw_chapters: "Raw archive",
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

// ==========================================
// SUB-COMPONENTS (REUSABLE PORTIONS)
// ==========================================

// --- Hero section for cover art, primary tracking features, and title stats ---
interface HeroProps {
	novel: Novel;
	chaptersCount: number;
	rawCatalogCount: number;
	coverSrc: string;
	user: any;
	adding: boolean;
	addMessage: string;
	firstReadableChapter: number;
	firstReadableRawChapter: number;
	onAddToLibrary: () => void;
}

function NovelHero({
	novel,
	chaptersCount,
	rawCatalogCount,
	coverSrc,
	user,
	adding,
	addMessage,
	firstReadableChapter,
	firstReadableRawChapter,
	onAddToLibrary,
}: HeroProps) {
	const chaptersTotal = novel.chaptersTotal || chaptersCount || 1;
	const archivePercentage = Math.min(100, Math.round((chaptersCount / chaptersTotal) * 100));

	return (
		<Card className="p-[1.1rem] flex flex-col md:flex-row gap-6 bg-[#fffdf8] border-[#dfd6c8] shadow-md">
			<div className="w-[190px] h-[260px] flex-shrink-0 border border-[#dfd6c8] rounded-lg bg-[#f8f5ee] flex items-center justify-center overflow-hidden mx-auto md:mx-0">
				{coverSrc ? (
					<img src={coverSrc} alt={novel.title} className="w-full h-full object-cover" />
				) : (
					<span className="text-3xl font-extrabold text-[#405f8f] opacity-50">{novel.title.slice(0, 2).toUpperCase()}</span>
				)}
			</div>

			<div className="flex-1 min-width-0 flex flex-col gap-4 text-[#24211d]">
				<div>
					<h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-[#24211d]">{novel.title}</h1>
					{(novel.alternativeNames || []).length > 0 && (
						<p className="text-sm text-[#5f584f] mt-1 italic">{novel.alternativeNames.slice(0, 3).join(" · ")}</p>
					)}
					<p className="text-[#5f584f] mt-1.5 text-sm md:text-base">
						By{" "}
						{novel.authorId ? (
							<Link href={`/authors/${novel.authorId}`} className="text-[#405f8f] hover:underline font-semibold">
								{getAuthor(novel)}
							</Link>
						) : (
							<span className="font-semibold">{getAuthor(novel)}</span>
						)}
					</p>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Status</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{novel.publicationStatus || "Unknown"}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Chapters</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{novel.chaptersTotal || chaptersCount || "?"}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Archived</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{chaptersCount}</strong>
					</div>
					<div className="p-3 border border-[#dfd6c8] rounded-md bg-[#f8f5ee]">
						<span className="block text-[10px] font-bold text-[#877d70] uppercase tracking-wider">Raw</span>
						<strong className="text-[#24211d] font-extrabold text-sm">{novel.rawChaptersTotal || 0}</strong>
					</div>
				</div>

				<div className="my-1">
					<div className="flex justify-between text-xs font-bold mb-1.5">
						<span className="text-[#5f584f]">Archive Progress</span>
						<span className="text-[#405f8f]">
							{chaptersCount} / {novel.chaptersTotal || chaptersCount || "?"} chapters ({archivePercentage}%)
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
					{chaptersCount > 0 ? (
						<Button asChild className="h-9 font-semibold text-xs bg-[#405f8f] hover:bg-[#304a72] text-white">
							<Link href={`/novels/${novel._id}/reader/${firstReadableChapter}`}>Start Reading</Link>
						</Button>
					) : novel.sourceUrl ? (
						<Button asChild className="h-9 font-semibold text-xs bg-[#405f8f] hover:bg-[#304a72] text-white">
							<a href={novel.sourceUrl} target="_blank" rel="noreferrer">
								Open Source
							</a>
						</Button>
					) : null}
					{rawCatalogCount > 0 && (
						<Button asChild variant="secondary" className="h-9 font-semibold text-xs">
							<Link href={`/novels/${novel._id}/reader/${firstReadableRawChapter}?source=raw`}>Open Raw</Link>
						</Button>
					)}
					{novel.rawSourceUrl && rawCatalogCount === 0 && (
						<Button asChild variant="secondary" className="h-9 font-semibold text-xs">
							<a href={novel.rawSourceUrl} target="_blank" rel="noreferrer">
								Open Raw Source
							</a>
						</Button>
					)}
				</div>
				{addMessage && <p className="text-xs text-[#5f584f] italic mt-1">{addMessage}</p>}

				<div className="flex flex-wrap gap-1.5 mt-1">
					{(novel.genres || []).map((genre) => (
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
	novel: Novel;
	jobs: BackgroundJob[];
	jobsLoading: boolean;
	activeJobTypes: Set<JobType>;
	processingJobCount: number;
	translatedArchivePercent: number;
	translatedPipelineSections: any[];
	rawPipelineSections: any[];
	commonAdminActions: any[];
	adminMessage: string;
	onFetchJobs: () => void;
}

function AdminConsole({
	novel,
	jobs,
	jobsLoading,
	activeJobTypes,
	processingJobCount,
	translatedArchivePercent,
	translatedPipelineSections,
	rawPipelineSections,
	commonAdminActions,
	adminMessage,
	onFetchJobs,
}: AdminConsoleProps) {
	const recentJobs = jobs.slice(0, 5);

	return (
		<Card className="p-[1.1rem] bg-gradient-to-b from-[#fffdf8] to-[#faf6ee] border-[#dfd6c8] flex flex-col gap-6 shadow-sm">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<span className="block text-[10px] font-black tracking-wider text-[#877d70] uppercase mb-1">Catalog administration</span>
					<h2 className="text-xl font-bold uppercase text-[#24211d]">{novel.title}</h2>
					<p className="text-sm text-[#5f584f] mt-1">
						Manage this shared novel record, queue indexing jobs, import chapter index HTML, and update catalog metadata.
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
						<span className="text-[10px] font-bold tracking-wider text-[#877d70] uppercase">Indexed chapters</span>
						<span className="text-xs font-bold text-[#405f8f]">{translatedArchivePercent}%</span>
					</div>
					<strong className="text-lg font-extrabold text-[#24211d]">
						{novel.chaptersList?.length || 0} / {novel.chaptersTotal || "?"}
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
									{section.actions.map((action: any) => (
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
									{section.actions.map((action: any) => (
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
					<p className="text-xs text-[#877d70] italic">No recent admin activity for this novel yet.</p>
				)}
			</section>
		</Card>
	);
}

// --- Table of Contents Listing Card ---
interface TOCProps {
	novel: Novel;
	chapters: any[];
	sortedItems: any[];
	chapterSearch: string;
	chapterSort: "asc" | "desc";
	onSearchChange: (val: string) => void;
	onSortToggle: () => void;
}

function TableOfContents({ novel, chapters, sortedItems, chapterSearch, chapterSort, onSearchChange, onSortToggle }: TOCProps) {
	return (
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dfd6c8] pb-3">
				<div>
					<h2 className="text-base font-bold text-[#24211d]">Table of Contents</h2>
					<p className="text-xs text-[#5f584f] mt-0.5">
						Archived translated: {chapters.length} / {novel.chaptersTotal || sortedItems.length || "?"} chapters.
					</p>
				</div>
				<div className="flex gap-2 items-center">
					<input
						type="text"
						placeholder="Search chapters..."
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
				</div>
			</div>

			{sortedItems.length === 0 ? (
				<p className="text-sm text-[#5f584f] mt-2">
					{chapters.length === 0 ? (
						<span>
							No translated chapters have been indexed yet.
							{novel.sourceUrl && (
								<>
									{" "}
									<a href={novel.sourceUrl} target="_blank" rel="noreferrer" className="text-[#405f8f] hover:underline font-bold">
										Open source page
									</a>
									.
								</>
							)}
						</span>
					) : (
						"No chapters match your search."
					)}
				</p>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[520px] overflow-y-auto pr-1">
						{sortedItems.slice(0, 120).map((chapterItem) => (
							<Link
								key={chapterItem.number}
								href={`/novels/${novel._id}/reader/${chapterItem.number}`}
								className={`grid gap-1 p-3 border border-[#dfd6c8] rounded-md transition-all duration-150 ${
									chapterItem.archived
										? "bg-[#f8f5ee] hover:bg-white hover:border-[#b9aa95]"
										: "bg-[#ece5d8]/40 hover:bg-[#f8f5ee] opacity-75 hover:opacity-100"
								}`}
							>
								<span className="text-[10px] font-black text-[#877d70] uppercase">Chapter {chapterItem.number}</span>
								<strong className="text-xs font-bold text-[#24211d] truncate">{chapterItem.title}</strong>
								{!chapterItem.archived && <small className="text-[9px] font-semibold text-[#877d70] uppercase">Indexed only</small>}
							</Link>
						))}
					</div>
					{sortedItems.length > 120 && (
						<p className="text-xs text-[#877d70] text-center mt-3 border-t border-slate-100 pt-3">
							Showing first 120 chapters. Use the search box above to locate specific numbers.
						</p>
					)}
				</>
			)}
		</Card>
	);
}

// --- Raw Table of Contents ---
interface RawTOCProps {
	novel: Novel;
	rawChapters: any[];
	sortedRawItems: any[];
	chapterSearch: string;
	chapterSort: "asc" | "desc";
	firstReadableRawChapter: number;
	onSearchChange: (val: string) => void;
	onSortToggle: () => void;
}

function RawTableOfContents({
	novel,
	rawChapters,
	sortedRawItems,
	chapterSearch,
	chapterSort,
	firstReadableRawChapter,
	onSearchChange,
	onSortToggle,
}: RawTOCProps) {
	return (
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dfd6c8] pb-3">
				<div>
					<h2 className="text-base font-bold text-[#24211d]">Raw Table of Contents</h2>
					<p className="text-xs text-[#5f584f] mt-0.5">
						Archived raw: {rawChapters.length} / {novel.rawChaptersTotal || sortedRawItems.length} chapters.
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
							<Link href={`/novels/${novel._id}/reader/${firstReadableRawChapter}?source=raw`}>Open Raw Reader</Link>
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
								key={chapterItem.number}
								href={`/novels/${novel._id}/reader/${chapterItem.number}?source=raw`}
								className={`grid gap-1 p-3 border border-[#dfd6c8] rounded-md transition-all duration-150 ${
									chapterItem.archived
										? "bg-[#f8f5ee] hover:bg-white hover:border-[#b9aa95]"
										: "bg-[#ece5d8]/40 hover:bg-[#f8f5ee] opacity-75 hover:opacity-100"
								}`}
							>
								<span className="text-[10px] font-black text-[#877d70] uppercase">Raw {chapterItem.number}</span>
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

// --- Sidebar detailing metadata and other genres ---
interface SidebarProps {
	novel: Novel;
	chaptersCount: number;
	sortedItemsCount: number;
}

function DetailsSidebar({ novel, chaptersCount, sortedItemsCount }: SidebarProps) {
	return (
		<aside className="flex flex-col gap-5">
			<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-4">
				<h2 className="text-sm font-extrabold text-[#24211d] uppercase border-b border-[#dfd6c8] pb-1.5">Details</h2>
				<dl className="grid gap-4 text-xs">
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Publication</dt>
						<dd className="text-xs font-bold text-[#24211d]">{novel.publicationStatus || "Unknown"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Original source</dt>
						<dd className="text-xs font-bold text-[#24211d] truncate">
							{novel.originalSource ? (
								<a href={novel.originalSource} target="_blank" rel="noreferrer" className="text-[#405f8f] hover:underline">
									{novel.originalSource}
								</a>
							) : (
								"Unknown"
							)}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Language</dt>
						<dd className="text-xs font-bold text-[#24211d]">{novel.rawOriginalLanguage || "Translated"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Archived chapters</dt>
						<dd className="text-xs font-bold text-[#24211d]">
							{chaptersCount} / {novel.chaptersTotal || sortedItemsCount || "?"}
						</dd>
					</div>
					{novel.alternativeNames && novel.alternativeNames.length > 0 && (
						<div className="grid gap-0.5">
							<dt className="text-[10px] font-extrabold text-[#877d70] uppercase tracking-wide">Alternative names</dt>
							<dd className="text-xs font-medium text-[#5f584f] leading-relaxed">{novel.alternativeNames.join(", ")}</dd>
						</div>
					)}
				</dl>
			</Card>

			<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-4">
				<h2 className="text-sm font-extrabold text-[#24211d] uppercase border-b border-[#dfd6c8] pb-1.5">Genres</h2>
				<div className="flex flex-wrap gap-1.5">
					{!novel.genres || novel.genres.length === 0 ? (
						<span className="text-xs text-[#5f584f] italic">No genres indexed.</span>
					) : (
						novel.genres.map((genre) => (
							<Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
								<Badge className="bg-[#fffdf8] border-[#dfd6c8] text-[#5d6474] hover:bg-[#f8f5ee] font-bold text-[10px] uppercase tracking-wider py-1">
									{genre}
								</Badge>
							</Link>
						))
					)}
				</div>
			</Card>
		</aside>
	);
}

// ==========================================
// MAIN DEFAULT EXPORT COMPONENT
// ==========================================

export default function PublicNovelDetails({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const { user, hasCapability } = useAuth();
	const { showToast } = useToast();

	// Page & Core UI Data States
	const [novel, setNovel] = useState<Novel | null>(null);
	const [chapters, setChapters] = useState<Omit<ChapterContent, "content">[]>([]);
	const [rawChapters, setRawChapters] = useState<Omit<ChapterContent, "content">[]>([]);
	const [authorNovels, setAuthorNovels] = useState<Novel[]>([]);
	const [jobs, setJobs] = useState<BackgroundJob[]>([]);
	const [loading, setLoading] = useState(true);

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
	const [activeTab, setActiveTab] = useState<"read" | "admin">("read");
	const [chapterSearch, setChapterSearch] = useState("");
	const [chapterSort, setChapterSort] = useState<"asc" | "desc">("asc");

	const fetchNovelJobs = async () => {
		if (!hasCapability(CAPABILITY.JOBS_LIST)) return;
		setJobsLoading(true);
		try {
			const jobData = await api.getNovelJobs(id);
			setJobs(jobData);
		} catch (err) {
			console.error("Failed to load novel jobs:", err);
		} finally {
			setJobsLoading(false);
		}
	};

	const refreshChapterLists = async () => {
		const [chapterData, rawChapterData] = await Promise.all([api.getPublicChapters(id).catch(() => []), api.getPublicRawChapters(id).catch(() => [])]);
		setChapters(chapterData);
		setRawChapters(rawChapterData);
	};

	// --- Primary Data Fetch ---
	useEffect(() => {
		async function loadNovel() {
			setLoading(true);
			try {
				const novelData = await api.getPublicNovel(id);
				const [chapterData, rawChapterData, authorData] = await Promise.all([
					api.getPublicChapters(id).catch(() => []),
					api.getPublicRawChapters(id).catch(() => []),
					novelData.authorId ? api.getPublicAuthor(novelData.authorId).catch(() => null) : Promise.resolve(null),
				]);
				setNovel(novelData);
				setChapters(chapterData);
				setRawChapters(rawChapterData);
				setAuthorNovels((authorData?.novels || []).filter((item) => item._id !== novelData._id).slice(0, 6));
			} catch (err) {
				console.error("Failed to load public novel:", err);
			} finally {
				setLoading(false);
			}
		}
		loadNovel();
	}, [id]);

	// Initialize Edit Controls Form
	useEffect(() => {
		if (!novel) return;
		setEditTitle(novel.title || "");
		setEditAuthor(novel.author || "");
		setEditAuthorPenName(novel.authorPenName || "");
		setEditAuthorRealName(novel.authorRealName || "");
		setEditAlternativeNames((novel.alternativeNames || []).join(", "));
		setEditGenres((novel.genres || []).join(", "));
		setEditOriginalSource(novel.originalSource || "");
		setEditPublicationStatus(novel.publicationStatus || "");
		setEditDescription(novel.description || "");
		setEditCoverUrl(novel.coverUrl || "");
		setEditSourceUrl(novel.sourceUrl || "");
		setEditRawSourceUrl(novel.rawSourceUrl || "");
		setEditRawOriginalLanguage(novel.rawOriginalLanguage || "");
	}, [novel]);

	// Fetch Jobs Loop
	useEffect(() => {
		if (hasCapability(CAPABILITY.JOBS_LIST)) {
			fetchNovelJobs();
		} else {
			setJobs([]);
		}
	}, [id, user?.capabilities, hasCapability]);

	const firstReadableChapter = useMemo(() => chapters[0]?.chapterNumber || 1, [chapters]);

	// Catalog items builders
	const rawCatalogItems = useMemo(() => {
		if (!novel) return [];
		const archivedByNumber = new Map(rawChapters.map((chapter) => [chapter.chapterNumber, chapter]));
		const seen = new Set<number>();
		const indexedItems: any[] = [];
		for (const chapter of novel.rawChaptersList || []) {
			if (!Number.isFinite(chapter.number) || seen.has(chapter.number)) continue;
			seen.add(chapter.number);
			const archived = archivedByNumber.get(chapter.number);
			const archivedTitle = archived?.title?.trim() || "";
			const indexedTitle = chapter.title?.trim() || "";
			indexedItems.push({
				number: chapter.number,
				title:
					archivedTitle && !isGenericChapterTitle(archivedTitle, novel.title, chapter.number)
						? archivedTitle
						: indexedTitle || archivedTitle || `Raw Chapter ${chapter.number}`,
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || chapter.url,
				scrapedAt: archived?.scrapedAt,
			});
		}

		const archivedOnlyItems = Array.from(archivedByNumber.values())
			.filter((chapter) => !seen.has(chapter.chapterNumber))
			.map((chapter) => ({
				number: chapter.chapterNumber,
				title: chapter.title || `Raw Chapter ${chapter.chapterNumber}`,
				archived: true,
				sourceUrl: chapter.sourceUrl,
				scrapedAt: chapter.scrapedAt,
			}));

		return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.number - b.number);
	}, [novel, rawChapters]);

	const translatedCatalogItems = useMemo(() => {
		if (!novel) return [];
		const archivedByNumber = new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter]));
		const seen = new Set<number>();
		const indexedItems: any[] = [];
		for (const chapter of novel.chaptersList || []) {
			if (!Number.isFinite(chapter.number) || seen.has(chapter.number)) continue;
			seen.add(chapter.number);
			const archived = archivedByNumber.get(chapter.number);
			const archivedTitle = archived?.title?.trim() || "";
			const indexedTitle = chapter.title?.trim() || "";
			indexedItems.push({
				number: chapter.number,
				title:
					archivedTitle && !isGenericChapterTitle(archivedTitle, novel.title, chapter.number)
						? archivedTitle
						: indexedTitle || archivedTitle || `Chapter ${chapter.number}`,
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || chapter.url,
				scrapedAt: archived?.scrapedAt,
			});
		}

		const archivedOnlyItems = Array.from(archivedByNumber.values())
			.filter((chapter) => !seen.has(chapter.chapterNumber))
			.map((chapter) => ({
				number: chapter.chapterNumber,
				title: chapter.title || `Chapter ${chapter.chapterNumber}`,
				archived: true,
				sourceUrl: chapter.sourceUrl,
				scrapedAt: chapter.scrapedAt,
			}));

		return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.number - b.number);
	}, [novel, chapters]);

	const firstReadableRawChapter = useMemo(() => rawCatalogItems[0]?.number || rawChapters[0]?.chapterNumber || 1, [rawCatalogItems, rawChapters]);

	// Sorting and filtering datasets
	const sortedTranslatedItems = useMemo(() => {
		let items = [...translatedCatalogItems];
		if (chapterSearch.trim()) {
			const searchLower = chapterSearch.toLowerCase();
			items = items.filter((item) => item.number.toString().includes(searchLower) || item.title.toLowerCase().includes(searchLower));
		}
		if (chapterSort === "desc") {
			items.reverse();
		}
		return items;
	}, [translatedCatalogItems, chapterSearch, chapterSort]);

	const sortedRawItems = useMemo(() => {
		let items = [...rawCatalogItems];
		if (chapterSearch.trim()) {
			const searchLower = chapterSearch.toLowerCase();
			items = items.filter((item) => item.number.toString().includes(searchLower) || item.title.toLowerCase().includes(searchLower));
		}
		if (chapterSort === "desc") {
			items.reverse();
		}
		return items;
	}, [rawCatalogItems, chapterSearch, chapterSort]);

	const coverSrc = novel ? getNovelCoverUrl(novel) : "";
	const canManageCatalog = hasCapability(CAPABILITY.NOVELS_MANAGE) || hasCapability(CAPABILITY.NOVELS_CREATE) || hasCapability(CAPABILITY.NOVELS_UPDATE);
	const canReadJobs = hasCapability(CAPABILITY.JOBS_LIST);
	const canScrape = hasCapability(CAPABILITY.JOBS_SCRAPE);
	const canImport = hasCapability(CAPABILITY.JOBS_IMPORT);
	const canAdmin = canManageCatalog || canReadJobs || canScrape || canImport;
	const activeJobTypes = useMemo(() => new Set(jobs.filter((job) => job.status === "pending" || job.status === "processing").map((job) => job.type)), [jobs]);
	const processingJobCount = jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
	const translatedChapterTotal = novel?.chaptersTotal || translatedCatalogItems.length || 0;
	const translatedArchivePercent = translatedChapterTotal ? Math.min(100, Math.round((chapters.length / translatedChapterTotal) * 100)) : 0;

	const translatedPipelineSections = canScrape || canImport ? [
		{
			key: "translated-indexing",
			title: "Indexing",
			actions: [
				{
					key: "scrape_metadata-queue",
					label: "Queue translated index",
					tone: "translated",
					disabled: !canScrape || !novel?.sourceUrl || Boolean(queueing) || activeJobTypes.has("scrape_metadata"),
					busy: queueing === "scrape_metadata",
					onClick: () => handleTriggerScrape("scrape_metadata"),
				},
				{
					key: "scrape_metadata-now",
					label: "Index translated now",
					tone: "raw",
					disabled: !canScrape || !novel?.sourceUrl || Boolean(runningNow),
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
					key: "scrape_chapters-queue",
					label: "Queue translated archive",
					tone: "translated",
					disabled: !canScrape || !(novel?.chaptersList || []).length || Boolean(queueing) || activeJobTypes.has("scrape_chapters"),
					busy: queueing === "scrape_chapters",
					onClick: () => handleTriggerScrape("scrape_chapters"),
				},
				{
					key: "scrape_chapters-now",
					label: "Archive next 5 translated",
					tone: "success",
					disabled: !canScrape || translatedCatalogItems.length === 0 || Boolean(runningNow),
					busy: runningNow === "scrape_chapters",
					onClick: () => handleRunScrapeNow("scrape_chapters"),
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
					disabled: !canImport || !novel?.sourceUrl,
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
					disabled: !canScrape || !novel?.rawSourceUrl || Boolean(queueing) || activeJobTypes.has("scrape_raw_metadata"),
					busy: queueing === "scrape_raw_metadata",
					onClick: () => handleTriggerScrape("scrape_raw_metadata"),
				},
				{
					key: "scrape_raw_metadata-now",
					label: "Index raw now",
					tone: "raw",
					disabled: !canScrape || !novel?.rawSourceUrl || Boolean(runningNow),
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
					key: "scrape_raw_chapters-queue",
					label: "Queue raw archive",
					tone: "raw",
					disabled: !canScrape || rawCatalogItems.length === 0 || Boolean(queueing) || activeJobTypes.has("scrape_raw_chapters"),
					busy: queueing === "scrape_raw_chapters",
					onClick: () => handleTriggerScrape("scrape_raw_chapters"),
				},
				{
					key: "scrape_raw_chapters-now",
					label: "Archive next 5 raw",
					tone: "success",
					disabled: !canScrape || rawCatalogItems.length === 0 || Boolean(runningNow),
					busy: runningNow === "scrape_raw_chapters",
					onClick: () => handleRunScrapeNow("scrape_raw_chapters"),
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
					disabled: !canImport || !novel?.rawSourceUrl,
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
			onClick: () => setIsEditCatalogOpen(true),
		},
		novel?.sourceUrl
			? {
					key: "open-translated-source",
					label: "Open Source Page",
					tone: "neutral",
					disabled: false,
					href: novel.sourceUrl,
				}
			: null,
		novel?.rawSourceUrl
			? {
					key: "open-raw-source",
					label: "Open Raw Source",
					tone: "neutral",
					disabled: false,
					href: novel.rawSourceUrl,
				}
			: null,
		{
			key: "refresh-jobs",
			label: jobsLoading ? "Refreshing jobs..." : "Refresh Log Jobs",
			tone: "neutral",
			disabled: !canReadJobs || jobsLoading,
			onClick: fetchNovelJobs,
		},
	].filter(Boolean);

	// --- Handlers ---
	const handleAddToLibrary = async () => {
		if (!novel || !user) return;
		setAdding(true);
		setAddMessage("");
		try {
			const created = await api.addNovelToLibrary(novel._id);
			setAddMessage("Added to your profile library.");
			window.setTimeout(() => {
				window.location.href = `/profile/novels/${created._id}`;
			}, 700);
		} catch (err: any) {
			setAddMessage(err.message || "Could not add this novel.");
		} finally {
			setAdding(false);
		}
	};

	const handleTriggerScrape = async (type: JobType) => {
		if (!novel) return;
		setQueueing(type);
		setAdminMessage("");
		try {
			const result = await api.triggerScrape(novel._id, type);
			setAdminMessage(result.message || "Scraper job queued.");
			await fetchNovelJobs();
		} catch (err: any) {
			setAdminMessage(err.message || "Could not queue scraper job.");
		} finally {
			setQueueing(null);
		}
	};

	const handleRunScrapeNow = async (type: JobType) => {
		if (!novel) return;
		setRunningNow(type);
		setAdminMessage("");
		try {
			const result = await api.runScrapeNow(novel._id, type, { limit: 5 });
			setNovel(result.novel);
			await refreshChapterLists();
			setAdminMessage(result.message || "Direct scraper run completed.");
			await fetchNovelJobs();
		} catch (err: any) {
			setAdminMessage(err.message || "Direct scraper run failed.");
			await fetchNovelJobs();
		} finally {
			setRunningNow(null);
		}
	};

	const openIndexHtmlImport = (sourceKind: SourceKind) => {
		if (!novel) return;
		setIndexHtmlSourceKind(sourceKind);
		setIndexHtmlPageUrl(sourceKind === "raw" ? novel.rawSourceUrl || "" : novel.sourceUrl || "");
		setIndexHtmlContent("");
		setIsIndexHtmlModalOpen(true);
	};

	const handleImportIndexHtml = async (event: FormEvent) => {
		event.preventDefault();
		if (!novel) return;
		setImportingIndexHtml(true);
		setAdminMessage("");
		try {
			const result = await api.importHtmlIndex(novel._id, {
				sourceKind: indexHtmlSourceKind,
				html: indexHtmlContent,
				pageUrl: indexHtmlPageUrl || (indexHtmlSourceKind === "raw" ? novel.rawSourceUrl : novel.sourceUrl),
			});
			setNovel(result.novel);
			await refreshChapterLists();
			setAdminMessage(result.message);
			setIsIndexHtmlModalOpen(false);
			setIndexHtmlContent("");
			setIndexHtmlPageUrl("");
			await fetchNovelJobs();
		} catch (err: any) {
			setAdminMessage(err.message || "Could not import catalogue HTML.");
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

	if (!novel) {
		return (
			<div className="w-full max-w-[1520px] mx-auto px-5 py-8">
				<Card className="p-12 text-center border-[#dfd6c8] bg-[#fffdf8]">
					<h1 className="text-xl font-extrabold text-[#24211d]">Novel Not Found</h1>
					<Button asChild variant="secondary" className="mt-4 text-xs font-bold border-[#dfd6c8] hover:bg-slate-50">
						<Link href="/">Back Home</Link>
					</Button>
				</Card>
			</div>
		);
	}

	return (
		<div className="w-full max-w-[1520px] mx-auto px-4 md:px-5 py-6 md:py-8 flex flex-col gap-6">
			{/* Novel Hero block */}
			<NovelHero
				novel={novel}
				chaptersCount={chapters.length}
				rawCatalogCount={rawCatalogItems.length}
				coverSrc={coverSrc}
				user={user}
				adding={adding}
				addMessage={addMessage}
				firstReadableChapter={firstReadableChapter}
				firstReadableRawChapter={firstReadableRawChapter}
				onAddToLibrary={handleAddToLibrary}
			/>

			{/* Custom Segmented Tabs (replaces old .detail-tabs) */}
			{canAdmin && (
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
				</div>
			)}

			{/* Scraper / Admin Board view */}
			{canAdmin && activeTab === "admin" && (
				<AdminConsole
					novel={novel}
					jobs={jobs}
					jobsLoading={jobsLoading}
					activeJobTypes={activeJobTypes}
					processingJobCount={processingJobCount}
					translatedArchivePercent={translatedArchivePercent}
					translatedPipelineSections={translatedPipelineSections}
					rawPipelineSections={rawPipelineSections}
					commonAdminActions={commonAdminActions}
					adminMessage={adminMessage}
					onFetchJobs={fetchNovelJobs}
				/>
			)}

			{/* Reader view standard layout */}
			{(!canAdmin || activeTab === "read") && (
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
					<main className="flex flex-col gap-6">
						{/* Summary Block */}
						<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
							<h2 className="text-base font-bold text-[#24211d]">Novel Summary</h2>
							<p className="text-sm leading-relaxed whitespace-pre-line text-[#5f584f]">
								{novel.description || "No summary has been indexed for this novel yet."}
							</p>
						</Card>

						{/* Author Novels slider block */}
						{/* Author Novels slider block */}
						{authorNovels.length > 0 && (
							<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
								<h2 className="text-sm font-extrabold uppercase tracking-wider text-[#24211d]">Author&apos;s Other Novels</h2>
								<div className="flex flex-col border border-[#dfd6c8] rounded-md overflow-hidden bg-[#fffdf8]">
									{authorNovels.map((item) => {
										return (
											<Link
												key={item._id}
												href={`/novels/${item._id}`}
												className="flex gap-3.5 p-3 border-b border-[#dfd6c8]/60 last:border-b-0 hover:bg-[#f8f5ee]/50 transition-all group"
											>
												{/* Novel Thumb Cover */}
												<div className="w-[48px] h-[64px] bg-[#f8f5ee] border border-[#dfd6c8] rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
													{item.coverUrl ? (
														<img
															src={item.coverUrl}
															alt={item.title}
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
														<span className="font-semibold text-[#b65f3d]">{item.chaptersTotal || 0} chapters</span>

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

						{/* Translated TOC card */}
						<TableOfContents
							novel={novel}
							chapters={chapters}
							sortedItems={sortedTranslatedItems}
							chapterSearch={chapterSearch}
							chapterSort={chapterSort}
							onSearchChange={setChapterSearch}
							onSortToggle={() => setChapterSort((prev) => (prev === "asc" ? "desc" : "asc"))}
						/>

						{/* Raw TOC card */}
						{(novel.rawChaptersTotal > 0 || rawCatalogItems.length > 0) && (
							<RawTableOfContents
								novel={novel}
								rawChapters={rawChapters}
								sortedRawItems={sortedRawItems}
								chapterSearch={chapterSearch}
								chapterSort={chapterSort}
								firstReadableRawChapter={firstReadableRawChapter}
								onSearchChange={setChapterSearch}
								onSortToggle={() => setChapterSort((prev) => (prev === "asc" ? "desc" : "asc"))}
							/>
						)}
					</main>

					{/* Metadata layout sidebar */}
					<DetailsSidebar novel={novel} chaptersCount={chapters.length} sortedItemsCount={translatedCatalogItems.length} />
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
								if (!novel) return;
								setEditingCatalog(true);
								try {
									const updates: any = {
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
									const updated = await api.updateCatalogNovel(novel._id, updates);
									setNovel(updated);
									setIsEditCatalogOpen(false);
								} catch (err: any) {
									console.error("Failed to update catalog novel:", err);
									showToast({ message: err.message || "Failed to update catalog novel.", variant: "error" });								} finally {
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
