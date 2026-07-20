"use client";
import { useCallback } from 'react';
import { BottomSheet } from "../../ui/bottom-sheet";
import { TabBar } from "./tab-bar";
import { ReadTab } from "./read-tab";
import { DisplayTab } from "./display-tab";
import { SpeechTab } from "./speech-tab";
import { SettingsTab } from "./settings-tab";
import { MoreTab } from "./more-tab";
import type { ReaderBottomToolbarProps, ReaderBottomToolbarTab } from "./types";

export type { ReaderBottomToolbarProps, ReaderBottomToolbarTab } from "./types";

export function ReaderBottomToolbar(props: ReaderBottomToolbarProps) {
	const { isOpen, onOpenChange, activeTab, onTabChange } = props;

	const handleTabClick = useCallback(
		(tab: ReaderBottomToolbarTab) => {
			onTabChange(tab);
			onOpenChange(true);
		},
		[onOpenChange, onTabChange],
	);

	return (
		<BottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			header={<TabBar activeTab={activeTab} onTabClick={handleTabClick} />}
			contentClassName="h-[min(520px,calc(100dvh-7rem))] min-h-[300px] overflow-y-auto px-5 py-5 max-[640px]:h-[min(560px,calc(100dvh-6rem))]"
			closeLabel="Close reader settings"
		>
			{activeTab === "read" && <ReadTab {...props} />}
			{activeTab === "display" && <DisplayTab {...props} />}
			{activeTab === "speech" && <SpeechTab {...props} />}
			{activeTab === "settings" && <SettingsTab {...props} />}
			{activeTab === "more" && <MoreTab {...props} />}
		</BottomSheet>
	);
}
