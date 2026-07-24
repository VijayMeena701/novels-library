"use client";
import { useState } from "react";
import { cn } from "../../../lib/utils";
import { Field } from "../../ui/field";
import { ToggleRow } from "../../ui/toggle-row";
import { useFeatureFlags } from "../../../context/FeatureFlagsContext";
import type { ReaderBottomToolbarProps } from "./types";

type ReaderModeKey = "singlePage" | "infinite" | "oldReader";

const READER_MODE_OPTIONS: { key: ReaderModeKey; label: string }[] = [
	{ key: "singlePage", label: "Single Page" },
	{ key: "infinite", label: "Infinite" },
	{ key: "oldReader", label: "Old Reader" },
];

export function SettingsTab(props: ReaderBottomToolbarProps) {
	const { featureFlags } = useFeatureFlags();
	const enabledOptions = READER_MODE_OPTIONS.filter((option) => featureFlags.readerModes[option.key]);
	const [selectedMode, setSelectedMode] = useState<ReaderModeKey>(() => enabledOptions[0]?.key ?? "singlePage");

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="text-sm font-semibold text-[var(--reader-text)]">Reading behavior</h2>
				<p className="mt-1 text-xs leading-relaxed text-[var(--reader-muted)]">Choose how chapters are opened and which source the reader should use.</p>
			</div>
			{props.hasRawChapters && (
				<Field label="Reader source" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
					<div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--reader-border)]">
						<button
							type="button"
							onClick={() => props.switchReaderSource("translated")}
							className={cn(
								"min-h-10 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-inset",
								!props.isRawReader ? "bg-[var(--reader-accent)] text-[var(--reader-surface)]" : "bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
							)}
						>
							Translated
						</button>
						<button
							type="button"
							onClick={() => props.switchReaderSource("raw")}
							className={cn(
								"min-h-10 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-inset",
								props.isRawReader ? "bg-[var(--reader-accent)] text-[var(--reader-surface)]" : "bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
							)}
						>
							Raw
						</button>
					</div>
				</Field>
			)}

			<ToggleRow label="Auto-advance to next chapter" checked={props.autoOpenNext} onChange={props.onAutoOpenNextChange} />

			{enabledOptions.length > 1 && (
				<Field label="Reader type" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
					<div className={cn("overflow-hidden rounded-lg border border-[var(--reader-border)]", enabledOptions.length === 2 ? "grid grid-cols-2" : "grid grid-cols-3")}>
						{enabledOptions.map((option) => {
							const isActive = selectedMode === option.key;
							return (
								<button
									key={option.key}
									type="button"
									onClick={() => setSelectedMode(option.key)}
									className={cn(
										"min-h-10 text-[0.68rem] font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-inset",
										isActive
											? "bg-[var(--reader-accent)] text-[var(--reader-surface)]"
											: "bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
									)}
								>
									{option.label}
								</button>
							);
						})}
					</div>
				</Field>
			)}
		</div>
	);
}
