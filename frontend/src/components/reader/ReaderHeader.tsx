"use client";

import Link from "next/link";
import { ArrowLeft, List, Settings2 } from "lucide-react";

interface ReaderHeaderProps {
	bookId: string;
	bookTitle: string;
	catalogLength: number;
	onOpenCatalog: () => void;
	onOpenSettings: () => void;
}

export function ReaderHeader({ bookId, bookTitle, catalogLength, onOpenCatalog, onOpenSettings }: ReaderHeaderProps) {
	return (
		<div className="sticky top-0 z-50 border-b border-[var(--reader-border)] bg-[var(--reader-bg)]/95 px-4 py-3 backdrop-blur-[14px] max-[860px]:px-3">
			<div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4">
				<Link
					href={`/books/${bookId}`}
					className="inline-flex min-w-0 items-center gap-2 text-[0.78rem] font-medium text-[var(--reader-muted)] no-underline transition hover:text-[var(--reader-text)]"
				>
					<ArrowLeft className="size-4 shrink-0" />
					<span className="hidden sm:inline">Back to book</span>
				</Link>
				<span className="min-w-0 truncate text-center text-[0.78rem] font-medium text-[var(--reader-muted)]">{bookTitle}</span>
				<div className="flex shrink-0 items-center gap-1.5">
					<button
						type="button"
						onClick={onOpenCatalog}
						className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-1.5 text-[0.72rem] font-medium text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)]"
					>
						<List className="size-3.5" />
						<span className="hidden sm:inline">Contents</span>
						<span className="text-[var(--reader-muted)]">{catalogLength}</span>
					</button>
					<button
						type="button"
						onClick={onOpenSettings}
						aria-label="Open reader settings"
						title="Reader settings"
						className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)]"
					>
						<Settings2 className="size-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
