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

export function TabBar({ activeTab, onTabClick }: TabBarProps) {
	return (
		<nav className="flex items-center justify-between gap-1">
			{TABS.map((tab) => {
				const Icon = tabIcons[tab];
				const active = activeTab === tab;
				return (
					<button
						key={tab}
						type="button"
						onClick={() => onTabClick(tab)}
						className={cn(
							"flex flex-1 items-center justify-center gap-1 rounded-lg px-1 py-2 text-[0.65rem] font-bold capitalize transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
							active ? "bg-primary text-background" : "text-muted-copy hover:bg-surface-muted hover:text-foreground",
						)}
					>
						<Icon className="size-3.5" />
						<span>{tab}</span>
					</button>
				);
			})}
		</nav>
	);
}
