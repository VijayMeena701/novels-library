"use client";

import Link from "next/link";
import { useState } from "react";
import type { Book } from "../../utils/api";
import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Spinner } from "../ui/spinner";

interface BookDetailsSidebarProps {
	book: Book;
	chaptersCount: number;
	sortedItemsCount: number;
}

export function BookDetailsSidebar({ book, chaptersCount, sortedItemsCount }: BookDetailsSidebarProps) {
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
			<Card className="p-[1.1rem] bg-surface border-default shadow-elevation-1 flex flex-col gap-4">
				<h2 className="text-sm font-extrabold text-primary uppercase border-b border-default pb-1.5">Details</h2>
				<dl className="grid gap-4 text-xs">
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-muted uppercase tracking-wide">Publication Status</dt>
						<dd className="text-xs font-bold text-primary">{book.publicationStatus || "Unknown"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-muted uppercase tracking-wide">Original source</dt>
						<dd className="text-xs font-bold text-primary truncate">
							{book.originalSource ? (
								<a href={book.originalSource} target="_blank" rel="noreferrer" className="text-accent hover:underline">
									{book.originalSource}
								</a>
							) : (
								"Unknown"
							)}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-muted uppercase tracking-wide">Language</dt>
						<dd className="text-xs font-bold text-primary">{book.rawOriginalLanguage || "Translated"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-[10px] font-extrabold text-muted uppercase tracking-wide">Archived chapters</dt>
						<dd className="text-xs font-bold text-primary">
							{chaptersCount} / {book.translatedChaptersTotal || sortedItemsCount || "?"}
						</dd>
					</div>
					{book.alternativeNames && book.alternativeNames.length > 0 && (
						<div className="grid gap-0.5">
							<dt className="text-[10px] font-extrabold text-muted uppercase tracking-wide">Alternative names</dt>
							<dd className="text-xs font-medium text-secondary leading-relaxed">{book.alternativeNames.join(", ")}</dd>
						</div>
					)}
				</dl>
			</Card>

			<Card className="p-[1.1rem] bg-surface border-default shadow-elevation-1 flex flex-col gap-4">
				<h2 className="text-sm font-extrabold text-primary uppercase border-b border-default pb-1.5">Genres</h2>
				<div className="flex flex-wrap gap-1.5">
					{!book.genres || book.genres.length === 0 ? (
						<span className="text-xs text-secondary italic">No genres indexed.</span>
					) : (
						book.genres.map((genre) => (
							<Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
								<Badge className="bg-surface border-default text-secondary hover:bg-surface-raised font-bold text-[10px] uppercase tracking-wider py-1">
									{genre}
								</Badge>
							</Link>
						))
					)}
				</div>
			</Card>

			{user && (
				<Card className="p-[1.1rem] bg-surface border-default shadow-elevation-1 flex flex-col gap-3">
					<h2 className="text-sm font-extrabold text-primary uppercase border-b border-default pb-1.5">Report</h2>
					<div className="flex flex-col gap-2.5">
						<select
							className="w-full bg-input-bg border border-input rounded-md px-3 py-2 text-xs outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
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
							className="w-full bg-input-bg border border-input rounded-md px-3 py-2 text-xs outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
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
								<Spinner size="sm" />
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
