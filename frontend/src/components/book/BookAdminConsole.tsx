"use client";

import Link from "next/link";
import type { BackgroundJob, Book, JobType, SourceKind } from "../../utils/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
	formatActivityTime,
	formatJobStatusLabel,
	formatJobTypeLabel,
	getJobBadgeVariant,
	type CommonAdminAction,
	type PipelineSection,
} from "./book-details-helpers";

interface BookAdminConsoleProps {
	book: Book;
	jobs: BackgroundJob[];
	activeJobTypes: Set<JobType>;
	processingJobCount: number;
	translatedArchivePercent: number;
	canScrape: boolean;
	canImport: boolean;
	canReadJobs: boolean;
	canManageCatalog: boolean;
	queueing: JobType | null;
	runningNow: JobType | null;
	jobsLoading: boolean;
	adminMessage: string;
	onTriggerScrape: (type: JobType) => void;
	onRunScrapeNow: (type: JobType) => void;
	onEditCatalog: () => void;
	onRefreshJobs: () => void;
	onOpenIndexHtmlImport: (sourceKind: SourceKind) => void;
}

export function BookAdminConsole({
	book,
	jobs,
	activeJobTypes,
	processingJobCount,
	translatedArchivePercent,
	canScrape,
	canImport,
	canReadJobs,
	canManageCatalog,
	queueing,
	runningNow,
	jobsLoading,
	adminMessage,
	onTriggerScrape,
	onRunScrapeNow,
	onEditCatalog,
	onRefreshJobs,
	onOpenIndexHtmlImport,
}: BookAdminConsoleProps) {
	const recentJobs = jobs.slice(0, 5);

	const translatedPipelineSections: PipelineSection[] = canScrape || canImport ? [
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
					onClick: () => onTriggerScrape("scrape_metadata"),
				},
				{
					key: "scrape_metadata-now",
					label: "Index translated now",
					tone: "raw",
					disabled: !canScrape || !book?.sourceUrl || Boolean(runningNow),
					busy: runningNow === "scrape_metadata",
					onClick: () => onRunScrapeNow("scrape_metadata"),
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
					disabled: !canScrape || !(book?.translatedChaptersList || []).length || Boolean(queueing) || activeJobTypes.has("scrape_chapters"),
					busy: queueing === "scrape_chapters",
					onClick: () => onTriggerScrape("scrape_chapters"),
				},
				{
					key: "scrape_chapters-now",
					label: "Archive next 5 translated",
					tone: "success",
					disabled: !canScrape || (book.translatedChaptersList || []).length === 0 || Boolean(runningNow),
					busy: runningNow === "scrape_chapters",
					onClick: () => onRunScrapeNow("scrape_chapters"),
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
					onClick: () => onOpenIndexHtmlImport("translated"),
				},
			],
		},
	] : [];

	const rawPipelineSections: PipelineSection[] = canScrape || canImport ? [
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
					onClick: () => onTriggerScrape("scrape_raw_metadata"),
				},
				{
					key: "scrape_raw_metadata-now",
					label: "Index raw now",
					tone: "raw",
					disabled: !canScrape || !book?.rawSourceUrl || Boolean(runningNow),
					busy: runningNow === "scrape_raw_metadata",
					onClick: () => onRunScrapeNow("scrape_raw_metadata"),
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
					disabled: !canScrape || (book.rawChaptersList || []).length === 0 || Boolean(queueing) || activeJobTypes.has("scrape_raw_chapters"),
					busy: queueing === "scrape_raw_chapters",
					onClick: () => onTriggerScrape("scrape_raw_chapters"),
				},
				{
					key: "scrape_raw_chapters-now",
					label: "Archive next 5 raw",
					tone: "success",
					disabled: !canScrape || (book.rawChaptersList || []).length === 0 || Boolean(runningNow),
					busy: runningNow === "scrape_raw_chapters",
					onClick: () => onRunScrapeNow("scrape_raw_chapters"),
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
					onClick: () => onOpenIndexHtmlImport("raw"),
				},
			],
		},
	] : [];

	const commonAdminActions: CommonAdminAction[] = [
		{
			key: "edit-catalog",
			label: "Edit Book Details",
			tone: "neutral",
			disabled: !canManageCatalog,
			onClick: onEditCatalog,
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
			onClick: onRefreshJobs,
		},
	].filter((action): action is CommonAdminAction => action !== null);

	return (
		<Card className="p-[1.1rem] bg-gradient-to-b from-[#fffdf8] to-[#faf6ee] border-[#dfd6c8] flex flex-col gap-6 shadow-sm">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<span className="block text-[10px] font-black tracking-wider text-[#877d70] uppercase mb-1">Catalog administration</span>
					<h2 className="text-xl font-bold uppercase text-[#24211d]">{book.title}</h2>
					<p className="text-sm text-[#5f584f] mt-1">
						Manage this shared book record, queue indexing jobs, import chapter index HTML, and update catalog metadata.
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
						{book.translatedChaptersList?.length || 0} / {book.translatedChaptersTotal || "?"}
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
