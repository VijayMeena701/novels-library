"use client";

import React from "react";
import Link from "next/link";
import { DockButton } from "../../ui/dock-button";
import type { ReaderBottomToolbarProps } from "./types";

export function ReadTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="grid grid-cols-2 gap-2">
			<DockButton onClick={props.onPreviousUnit} disabled={!props.hasPreviousUnit} label="Previous">
				<span className="text-[0.65rem] text-muted-copy">Unit {props.previousUnitNumber}</span>
			</DockButton>
			<DockButton onClick={props.onNextUnit} disabled={!props.hasNextUnit} label="Next">
				<span className="text-[0.65rem] text-muted-copy">Unit {props.nextUnitNumber}</span>
			</DockButton>
			<DockButton onClick={props.onOpenCatalog} label="Contents">
				<span className="text-[0.65rem] text-muted-copy">{props.catalogItemsLength} units</span>
			</DockButton>
			<Link href={`/books/${props.bookId}`} className="contents">
				<DockButton label="Book">
					<span className="text-[0.65rem] text-muted-copy line-clamp-1">{props.bookTitle}</span>
				</DockButton>
			</Link>
		</div>
	);
}
