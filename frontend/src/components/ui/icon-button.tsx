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
				"flex min-h-10 items-center justify-center rounded-lg border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
				variant === "primary"
					? "border-primary bg-primary text-background hover:bg-primary-hover"
					: "border-border bg-surface text-foreground hover:bg-surface-muted",
				className,
			)}
			{...props}
		>
			{icon}
		</button>
	);
}
