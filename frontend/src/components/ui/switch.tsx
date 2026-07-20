
import { cn } from "../../lib/utils";

export interface SwitchProps {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	className?: string;
	theme?: "default" | "reader";
	"aria-label"?: string;
	disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, className, theme = "default", "aria-label": ariaLabel, disabled }: SwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={(event) => {
				onCheckedChange(!checked);
				event.stopPropagation();
			}}
			className={cn(
				"relative inline-flex h-5 w-9 shrink-0 items-center rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
				theme === "reader"
					? "focus:ring-[var(--reader-accent)] focus:ring-offset-[var(--reader-bg)]"
					: "focus:ring-primary focus:ring-offset-background",
				checked
					? theme === "reader"
						? "border-[var(--reader-accent)] bg-[var(--reader-accent)]"
						: "border-primary bg-primary"
					: theme === "reader"
						? "border-[var(--reader-border)] bg-[var(--reader-surface)]"
						: "border-border bg-surface",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
		>
			<span
				className={cn(
					cn(
						"inline-block size-3.5 transform rounded-lg shadow-card transition-transform duration-200",
						theme === "reader" ? "bg-[var(--reader-bg)]" : "bg-background",
					),
					checked ? "translate-x-4" : "translate-x-1",
				)}
			/>
		</button>
	);
}
