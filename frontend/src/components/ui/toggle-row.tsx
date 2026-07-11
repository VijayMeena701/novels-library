import React from "react";
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
				"flex items-center justify-between gap-3 text-left text-sm font-semibold text-copy hover:opacity-95 cursor-pointer select-none",
				disabled && "opacity-50 cursor-not-allowed",
				className,
			)}
			onClick={() => !disabled && onChange(!checked)}
		>
			<span>{label}</span>
			<Switch
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
