
import { cn } from "../../lib/utils";
import { Switch } from "./switch";

export interface ToggleRowProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	className?: string;
	disabled?: boolean;
}

export function ToggleRow({ label, checked, onChange, className, disabled }: ToggleRowProps) {
	return (
		<label
			className={cn(
				"flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-left text-sm font-medium text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)] cursor-pointer select-none",
				disabled && "opacity-50 cursor-not-allowed",
				className,
			)}
			onClick={() => !disabled && onChange(!checked)}
		>
			<span>{label}</span>
			<Switch
				theme="reader"
				checked={checked}
				onCheckedChange={(value) => {
					if (!disabled) onChange(value);
				}}
				aria-label={label}
				disabled={disabled}
			/>
		</label>
	);
}
