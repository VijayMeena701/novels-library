"use client";
import Link from "next/link";
import { DockButton } from "../../ui/dock-button";
import type { ReaderBottomToolbarProps } from "./types";

export function ReadTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="grid grid-cols-2 gap-2">
			<DockButton onClick={props.onPreviousChapter} disabled={!props.hasPreviousChapter} label="Previous">
				<span className="text-[0.65rem] text-muted-copy">Chapter {props.previousChapterNumber}</span>
			</DockButton>
			<DockButton onClick={props.onNextChapter} disabled={!props.hasNextChapter} label="Next">
				<span className="text-[0.65rem] text-muted-copy">Chapter {props.nextChapterNumber}</span>
			</DockButton>
			<DockButton onClick={props.onOpenCatalog} label="Contents">
				<span className="text-[0.65rem] text-muted-copy">{props.catalogItemsLength} chapters</span>
			</DockButton>
			<Link href={`/books/${props.bookId}`} className="contents">
				<DockButton label="Book">
					<span className="text-[0.65rem] text-muted-copy line-clamp-1">{props.bookTitle}</span>
				</DockButton>
			</Link>
		</div>
	);
}
