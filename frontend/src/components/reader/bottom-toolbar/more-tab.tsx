"use client";

import React from "react";
import Link from "next/link";
import { DockButton } from "../../ui/dock-button";
import type { ReaderBottomToolbarProps } from "./types";

export function MoreTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="grid grid-cols-2 gap-2">
			{props.sourceUrl && (
				<a href={props.sourceUrl} target="_blank" rel="noreferrer" className="contents">
					<DockButton label="Source">
						<span className="text-[0.65rem] text-muted-copy">Original page</span>
					</DockButton>
				</a>
			)}
			<DockButton onClick={props.onScrollToTop} label="Top">
				<span className="text-[0.65rem] text-muted-copy">Return to title</span>
			</DockButton>
			<Link href={props.isLoggedIn ? `/profile/novels/${props.novelId}` : "/login"} className="contents">
				<DockButton label={props.isLoggedIn ? "Profile Details" : "Login"}>
					<span className="text-[0.65rem] text-muted-copy">
						{props.isLoggedIn ? "Open your private notes" : "Track reading progress"}
					</span>
				</DockButton>
			</Link>
		</div>
	);
}
