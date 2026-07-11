import React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	className?: string;
	"aria-label"?: string;
	disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, className, "aria-label": ariaLabel, disabled }: SwitchProps) {
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
				"relative inline-flex h-5 w-9 shrink-0 items-center rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
				checked ? "border-primary bg-primary" : "border-border bg-surface",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
		>
			<span
				className={cn(
					"inline-block size-3.5 transform rounded-lg bg-background shadow-card transition-transform duration-200",
					checked ? "translate-x-4" : "translate-x-1",
				)}
			/>
		</button>
	);
}
