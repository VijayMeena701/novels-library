"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLoginHref } from "../../../lib/utils";
import { DockButton } from "../../ui/dock-button";
import type { ReaderBottomToolbarProps } from "./types";

export function MoreTab(props: ReaderBottomToolbarProps) {
	const pathname = usePathname();
	return (
		<div className="flex flex-col gap-5">
			<div>
				<h2 className="text-sm font-semibold text-[var(--reader-text)]">Quiet extras</h2>
				<p className="mt-1 text-xs leading-relaxed text-[var(--reader-muted)]">Keep supporting actions nearby without taking focus from the text.</p>
			</div>
			<div className="grid grid-cols-2 gap-2">
			{props.sourceUrl && (
				<a href={props.sourceUrl} target="_blank" rel="noreferrer" className="contents">
					<DockButton label="Source">
						<span className="text-[0.68rem] text-[var(--reader-muted)]">Original page</span>
					</DockButton>
				</a>
			)}
			<DockButton onClick={props.onScrollToTop} label="Top">
				<span className="text-[0.68rem] text-[var(--reader-muted)]">Return to title</span>
			</DockButton>
			<Link href={props.isLoggedIn ? `/books/${props.bookId}` : getLoginHref(pathname)} className="contents">
				<DockButton label={props.isLoggedIn ? "Profile Details" : "Login"}>
					<span className="text-[0.68rem] text-[var(--reader-muted)]">
						{props.isLoggedIn ? "Open your private notes" : "Track reading progress"}
					</span>
				</DockButton>
			</Link>
			</div>
		</div>
	);
}
