import React from "react";
import { cn } from "../../lib/utils";

export interface DockButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	label?: string;
	children: React.ReactNode;
}

export function DockButton({ label, children, className, ...props }: DockButtonProps) {
	return (
		<button
			type="button"
			className={cn(
				"flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface p-3 text-left transition hover:bg-surface-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
				className,
			)}
			{...props}
		>
			{label ? <strong className="text-xs font-bold text-foreground">{label}</strong> : null}
			{children}
		</button>
	);
}
