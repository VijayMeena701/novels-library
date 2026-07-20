
import { cn } from "../../lib/utils";

export interface SpinnerProps {
	size?: "sm" | "md" | "lg" | "xl";
	className?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps["size"]>, string> = {
	sm: "size-4 border-2",
	md: "size-6 border-4",
	lg: "size-8 border-4",
	xl: "size-10 border-4",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
	return (
		<div
			className={cn(
				"animate-spin rounded-full border-muted-copy border-t-primary",
				sizeClasses[size],
				className,
			)}
			role="status"
			aria-label="Loading"
		/>
	);
}
