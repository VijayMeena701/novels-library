"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";

export interface ReaderCatalogChapter {
	chapterNumber: number;
	title: string;
	archived: boolean;
	sourceUrl?: string;
	scrapedAt?: string;
}

export interface ReaderCatalogProps {
	isOpen: boolean;
	onClose: () => void;
	items: ReaderCatalogChapter[];
	currentChapterNumber: number;
	onSelectChapter: (chapterNumber: number) => void;
	isRawReader?: boolean;
	archivedCount?: number;
}

export function ReaderCatalog(props: ReaderCatalogProps) {
	const { isOpen, onClose, items, currentChapterNumber, onSelectChapter, isRawReader = false, archivedCount } = props;
	const [search, setSearch] = useState("");
	const listRef = useRef<HTMLDivElement | null>(null);

	const filteredItems = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return items;

		return items.filter(
			(item) =>
				item.title.toLowerCase().includes(query) ||
				item.chapterNumber.toString().includes(query),
		);
	}, [items, search]);

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: filteredItems.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => 80,
		overscan: 5,
	});

	if (!isOpen) return null;

	const archivedTotal = archivedCount ?? items.filter((item) => item.archived).length;
	const sourceLabel = isRawReader ? "Raw" : "Translated";

	return (
		<div
			className="fixed inset-0 z-[1000] flex items-start justify-start overflow-hidden bg-[var(--reader-overlay)]"
			onClick={onClose}
		>
			<aside
				className="flex h-dvh max-h-dvh w-full max-w-[420px] flex-col gap-5 overflow-hidden border-r border-[var(--reader-border)] bg-[var(--reader-bg)] p-5 text-[var(--reader-text)] shadow-[18px_0_48px_rgba(0,0,0,0.16)]"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex shrink-0 items-start justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold tracking-tight">Contents</h2>
						<p className="mt-1 text-xs leading-relaxed text-[var(--reader-muted)]">
							{sourceLabel} · {items.length} chapters indexed, {archivedTotal} archived.
						</p>
					</div>
					<button
						type="button"
						className="min-h-8 rounded-full border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-1.5 text-xs font-medium text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)]"
						onClick={onClose}
					>
						Close
					</button>
				</div>

				<Input
					className="shrink-0 min-h-10 border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text)] placeholder:text-[var(--reader-muted)] focus:border-[var(--reader-accent)] focus:ring-[var(--reader-accent)]"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Search chapter number or title"
				/>

				<div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
					<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
						{virtualizer.getVirtualItems().map((virtualItem) => {
							const item = filteredItems[virtualItem.index];
							if (!item) return null;
							return (
								<div
									key={virtualItem.key}
									data-index={virtualItem.index}
									ref={virtualizer.measureElement}
									className="absolute left-0 top-0 w-full pb-1"
									style={{ transform: `translateY(${virtualItem.start}px)` }}
								>
									<button
										type="button"
										className={cn(
											"flex w-full flex-col gap-1 rounded-xl border border-transparent px-3.5 py-3 text-left text-[var(--reader-text)] transition hover:border-[var(--reader-border)] hover:bg-[var(--reader-surface)]",
											item.chapterNumber === currentChapterNumber &&
												"border-[var(--reader-accent)]/50 bg-[var(--reader-surface)]",
										)}
										onClick={() => {
											onClose();
											onSelectChapter(item.chapterNumber);
										}}
									>
										<span className="text-[0.68rem] font-medium text-[var(--reader-muted)]">Chapter {item.chapterNumber}</span>
										<strong className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</strong>
										<small className="text-[0.68rem] text-[var(--reader-muted)]">{item.archived ? "Archived" : "Indexed only"}</small>
									</button>
								</div>
							);
						})}
					</div>
				</div>
			</aside>
		</div>
	);
}
