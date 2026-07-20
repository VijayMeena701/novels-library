
import { cn } from "../../lib/utils";

export interface SliderProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	formatValue?: (value: number) => string;
	className?: string;
}

export function Slider({ label, value, min, max, step, onChange, formatValue, className }: SliderProps) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<div className="flex items-center justify-between">
				<span className="text-[0.68rem] font-medium tracking-wide text-[var(--reader-muted)]">{label}</span>
				<span className="text-xs font-semibold text-[var(--reader-text)]">{formatValue ? formatValue(value) : value}</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--reader-bg)] accent-[var(--reader-accent)]"
			/>
		</div>
	);
}
