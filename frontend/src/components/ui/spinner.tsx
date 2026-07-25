
import { cn } from "../../lib/utils";
import { spinnerVariants, type SpinnerVariantProps } from "../../design-system/components/spinner";

export interface SpinnerProps extends SpinnerVariantProps {
	className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
	return (
		<div
			className={cn(spinnerVariants({ size }), className)}
			role="status"
			aria-label="Loading"
		/>
	);
}
