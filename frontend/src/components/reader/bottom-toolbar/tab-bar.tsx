"use client";
import { cn } from "../../../lib/utils";
import { BookOpen, Settings, Sparkles, MoreHorizontal, Volume2, type LucideIcon } from "lucide-react";
import { TABS, type ReaderBottomToolbarTab } from "./types";

export interface TabBarProps {
	activeTab: ReaderBottomToolbarTab;
	onTabClick: (tab: ReaderBottomToolbarTab) => void;
}

const tabIcons: Record<ReaderBottomToolbarTab, LucideIcon> = {
	read: BookOpen,
	display: Sparkles,
	speech: Volume2,
	settings: Settings,
	more: MoreHorizontal,
};

const tabLabels: Record<ReaderBottomToolbarTab, string> = {
	read: "Navigate",
	display: "Appearance",
	speech: "Listen",
	settings: "Behavior",
	more: "More",
};

export function TabBar({ activeTab, onTabClick }: TabBarProps) {
	return (
		<nav aria-label="Reader settings" className="flex items-center justify-between gap-1">
			{TABS.map((tab) => {
				const Icon = tabIcons[tab];
				const active = activeTab === tab;
				return (
					<button
						key={tab}
						type="button"
						onClick={() => onTabClick(tab)}
						className={cn(
							"relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.68rem] font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-inset",
							active
								? "text-[var(--reader-text)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--reader-accent)]"
								: "text-[var(--reader-muted)] hover:text-[var(--reader-text)]",
						)}
					>
						<Icon className="size-4" />
						<span>{tabLabels[tab]}</span>
					</button>
				);
			})}
		</nav>
	);
}
