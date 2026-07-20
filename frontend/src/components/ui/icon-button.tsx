import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from "../../lib/utils";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon: ReactNode;
	variant?: "primary" | "secondary";
}

export function IconButton({ icon, variant = "secondary", className, ...props }: IconButtonProps) {
	return (
		<button
			type="button"
			className={cn(
				"flex min-h-10 items-center justify-center rounded-lg border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--reader-accent)] focus:ring-offset-2 focus:ring-offset-[var(--reader-bg)]",
				variant === "primary"
					? "border-[var(--reader-accent)] bg-[var(--reader-accent)] text-[var(--reader-surface)] hover:bg-[var(--reader-accent-hover)]"
					: "border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
				className,
			)}
			{...props}
		>
			{icon}
		</button>
	);
}
