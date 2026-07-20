import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from "../../lib/utils";

export interface DockButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	label?: string;
	children: ReactNode;
}

export function DockButton({ label, children, className, ...props }: DockButtonProps) {
	return (
		<button
			type="button"
			className={cn(
				"flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--reader-border)] bg-[var(--reader-bg)] p-3 text-left transition hover:border-[var(--reader-accent)]/50 hover:bg-[var(--reader-surface-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-offset-2 focus:ring-offset-[var(--reader-bg)]",
				className,
			)}
			{...props}
		>
			{label ? <strong className="text-xs font-semibold text-[var(--reader-text)]">{label}</strong> : null}
			{children}
		</button>
	);
}
