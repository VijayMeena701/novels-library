"use client";
import { cn } from "../../../lib/utils";
import { Field } from "../../ui/field";
import { ToggleRow } from "../../ui/toggle-row";
import type { ReaderBottomToolbarProps } from "./types";

export function SettingsTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="flex flex-col gap-4">
			{props.hasRawChapters && (
				<Field label="Reader Source">
					<div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
						<button
							type="button"
							onClick={() => props.switchReaderSource("translated")}
							className={cn(
								"min-h-10 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
								!props.isRawReader ? "bg-primary text-background" : "bg-surface text-copy hover:bg-surface-muted",
							)}
						>
							Translated
						</button>
						<button
							type="button"
							onClick={() => props.switchReaderSource("raw")}
							className={cn(
								"min-h-10 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
								props.isRawReader ? "bg-primary text-background" : "bg-surface text-copy hover:bg-surface-muted",
							)}
						>
							Raw
						</button>
					</div>
				</Field>
			)}

			<ToggleRow label="Auto-advance to next chapter" checked={props.autoOpenNext} onChange={props.onAutoOpenNextChange} />

			<Field label="Reader Type">
				<div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
					{["Single Page", "Infinite", "Old Reader"].map((item, index) => (
						<button
							key={item}
							type="button"
							disabled={index > 0}
							className={cn(
								"min-h-10 text-[0.65rem] font-bold transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
								index === 0
									? "bg-primary text-background"
									: "bg-surface text-muted-copy hover:bg-surface-muted disabled:opacity-50",
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
