"use client";
import { cn } from "../../../lib/utils";
import { Field } from "../../ui/field";
import { ToggleRow } from "../../ui/toggle-row";
import type { ReaderBottomToolbarProps } from "./types";

export function SettingsTab(props: ReaderBottomToolbarProps) {
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

			<Field label="Reader type" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
				<div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--reader-border)]">
					{["Single Page", "Infinite", "Old Reader"].map((item, index) => (
						<button
							key={item}
							type="button"
							disabled={index > 0}
							className={cn(
								"min-h-10 text-[0.68rem] font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-inset",
								index === 0
									? "bg-[var(--reader-accent)] text-[var(--reader-surface)]"
									: "bg-[var(--reader-surface)] text-[var(--reader-muted)] hover:bg-[var(--reader-surface-hover)] disabled:opacity-50",
							)}
						>
							{item}
						</button>
					))}
				</div>
			</Field>
		</div>
	);
}
