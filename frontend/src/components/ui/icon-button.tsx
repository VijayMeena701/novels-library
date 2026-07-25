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
				"flex min-h-10 items-center justify-center rounded-lg border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-reader-accent focus:ring-offset-2 focus:ring-offset-reader-bg",
				variant === "primary"
					? "border-reader-accent bg-reader-accent text-reader-surface hover:bg-reader-accent-hover"
					: "border-reader bg-reader-surface text-reader-paragraph hover:bg-reader-controls",
				className,
			)}
			{...props}
		>
			{icon}
		</button>
	);
}
