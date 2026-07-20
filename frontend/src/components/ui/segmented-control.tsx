
import { cn } from "../../lib/utils";

export interface SegmentedControlProps<T extends string> {
	options: readonly T[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
}

export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	className,
}: SegmentedControlProps<T>) {
	return (
		<div className={cn("grid auto-cols-fr grid-flow-col overflow-hidden rounded-lg border border-[var(--reader-border)]", className)}>
			{options.map((option) => (
				<button
					key={option}
					type="button"
					onClick={() => onChange(option)}
					className={cn(
						"min-h-9 border-r border-[var(--reader-border)] px-2 py-1.5 text-[0.7rem] font-medium capitalize transition-colors last:border-r-0 focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-inset",
						value === option
							? "bg-[var(--reader-accent)] text-[var(--reader-surface)]"
							: "bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
					)}
				>
					{option}
				</button>
			))}
		</div>
	);
}
