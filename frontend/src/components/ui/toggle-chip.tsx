
import { cn } from "../../lib/utils";

export interface ToggleChipProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	className?: string;
	disabled?: boolean;
}

export function ToggleChip({ label, checked, onChange, className, disabled }: ToggleChipProps) {
	return (
		<button
			type="button"
			aria-pressed={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				"rounded-md border px-2.5 py-1.5 text-[0.7rem] font-bold transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
				checked
					? "border-primary bg-primary-soft text-primary"
					: "border-border bg-surface text-muted-copy hover:text-foreground",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
		>
			{label}
		</button>
	);
}
