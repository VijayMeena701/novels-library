"use client";
import { Field } from "../../ui/field";
import { SegmentedControl } from "../../ui/segmented-control";
import type { ReaderBottomToolbarProps } from "./types";

export function DisplayTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="flex flex-col gap-4">
			<Field label="Theme">
				<SegmentedControl
					options={["light", "sepia", "dark"]}
					value={props.theme}
					onChange={props.onThemeChange}
				/>
			</Field>

			<Field label="Font Size">
				<div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
					<button
						type="button"
						onClick={props.onFontSizeDecrease}
						className="min-h-10 bg-surface text-sm font-bold text-foreground hover:bg-surface-muted transition"
					>
						A−
					</button>
					<span className="flex min-h-10 items-center justify-center border-x border-border bg-surface-muted text-xs font-bold text-foreground">
						{props.fontSize}px
					</span>
					<button
						type="button"
						onClick={props.onFontSizeIncrease}
						className="min-h-10 bg-surface text-sm font-bold text-foreground hover:bg-surface-muted transition"
					>
						A+
					</button>
				</div>
			</Field>

			<Field label="Reader Width">
				<SegmentedControl
					options={["narrow", "medium", "wide"]}
					value={props.readWidth}
					onChange={props.onReadWidthChange}
				/>
			</Field>
		</div>
	);
}
