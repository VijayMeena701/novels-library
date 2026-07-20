"use client";
import { Field } from "../../ui/field";
import { SegmentedControl } from "../../ui/segmented-control";
import type { ReaderBottomToolbarProps } from "./types";

export function DisplayTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="text-sm font-semibold text-[var(--reader-text)]">Reading appearance</h2>
				<p className="mt-1 text-xs leading-relaxed text-[var(--reader-muted)]">Set the page tone, text size, and comfortable reading width.</p>
			</div>

			<Field label="Theme" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
				<SegmentedControl
					options={["paper", "sepia", "forest", "night", "amoled"]}
					value={props.theme}
					onChange={props.onThemeChange}
					className="border-[var(--reader-border)]"
				/>
			</Field>

			<Field label="Font size" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
				<div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--reader-border)]">
					<button
						type="button"
						onClick={props.onFontSizeDecrease}
						className="min-h-10 bg-[var(--reader-bg)] text-sm font-semibold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)]"
					>
						A−
					</button>
					<span className="flex min-h-10 items-center justify-center border-x border-[var(--reader-border)] bg-[var(--reader-surface)] text-xs font-semibold text-[var(--reader-text)]">
						{props.fontSize}px
					</span>
					<button
						type="button"
						onClick={props.onFontSizeIncrease}
						className="min-h-10 bg-[var(--reader-bg)] text-sm font-semibold text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)]"
					>
						A+
					</button>
				</div>
			</Field>

			<Field label="Reader width" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
				<SegmentedControl
					options={["narrow", "medium", "wide"]}
					value={props.readWidth}
					onChange={props.onReadWidthChange}
					className="border-[var(--reader-border)]"
				/>
			</Field>
		</div>
	);
}
