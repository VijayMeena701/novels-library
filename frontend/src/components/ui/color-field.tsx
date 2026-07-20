
import { cn } from "../../lib/utils";

export interface ColorFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function ColorField({ label, value, onChange, className }: ColorFieldProps) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">{label}</span>
			<div className="flex items-center gap-2">
				<div className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
					<input
						type="color"
						value={value}
						onChange={(event) => onChange(event.target.value)}
						className="absolute inset-[-4px] size-[calc(100%+8px)] cursor-pointer border-0 p-0"
					/>
				</div>
				<input
					type="text"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="min-h-9 w-full min-w-0 rounded-lg border border-border bg-surface px-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
				/>
			</div>
		</div>
	);
}
