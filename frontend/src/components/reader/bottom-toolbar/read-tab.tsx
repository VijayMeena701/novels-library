"use client";
import Link from "next/link";
import { DockButton } from "../../ui/dock-button";
import type { ReaderBottomToolbarProps } from "./types";

export function ReadTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="flex flex-col gap-5">
			<div>
				<h2 className="text-sm font-semibold text-[var(--reader-text)]">Move through the book</h2>
				<p className="mt-1 text-xs leading-relaxed text-[var(--reader-muted)]">Jump between chapters or return to the book details.</p>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<DockButton onClick={props.onPreviousChapter} disabled={!props.hasPreviousChapter} label="Previous">
					<span className="text-[0.68rem] text-[var(--reader-muted)]">Chapter {props.previousChapterNumber}</span>
				</DockButton>
				<DockButton onClick={props.onNextChapter} disabled={!props.hasNextChapter} label="Next">
					<span className="text-[0.68rem] text-[var(--reader-muted)]">Chapter {props.nextChapterNumber}</span>
				</DockButton>
				<DockButton onClick={props.onOpenCatalog} label="Contents">
					<span className="text-[0.68rem] text-[var(--reader-muted)]">{props.catalogItemsLength} chapters</span>
				</DockButton>
				<Link href={`/books/${props.bookId}`} className="contents">
					<DockButton label="Book">
						<span className="line-clamp-1 text-[0.68rem] text-[var(--reader-muted)]">{props.bookTitle}</span>
					</DockButton>
				</Link>
			</div>
		</div>
	);
}
