import type { BackgroundJob, Book, JobType } from "../../utils/api";

export function getAuthor(book: Book): string {
	return book.authorPenName || book.author || book.authorRealName || "Unknown Author";
}

export function normalizeTitle(value: string): string {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isGenericChapterTitle(value: string, bookTitle: string, chapterNumber: number): boolean {
	const normalized = normalizeTitle(value);
	return !normalized || normalized === normalizeTitle(bookTitle) || normalized === `chapter ${chapterNumber}` || normalized === `ch ${chapterNumber}`;
}

export function formatJobTypeLabel(type: JobType): string {
	const labels: Record<JobType, string> = {
		scrape_metadata: "Translated index",
		scrape_chapters: "Translated archive",
		scrape_raw_metadata: "Raw index",
		scrape_raw_chapters: "Raw archive",
	};
	return labels[type];
}

export function formatJobStatusLabel(status: BackgroundJob["status"]): string {
	return status.replace(/_/g, " ");
}

export function formatActivityTime(timestamp: string): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(timestamp));
}

export function getJobBadgeVariant(status: BackgroundJob["status"]): "processing" | "completed" | "hold" | "dropped" | "default" {
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

export interface CatalogItem {
	chapterNumber: number;
	title: string;
	archived: boolean;
	sourceUrl?: string;
	scrapedAt?: string;
}

export interface PipelineAction {
	key: string;
	label: string;
	tone: string;
	disabled: boolean;
	busy?: boolean;
	onClick: () => void;
}

export interface PipelineSection {
	key: string;
	title: string;
	actions: PipelineAction[];
}

export type CommonAdminAction =
	| { key: string; label: string; tone: string; disabled: boolean; onClick: () => void }
	| { key: string; label: string; tone: string; disabled: boolean; href: string };
