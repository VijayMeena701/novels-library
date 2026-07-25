import { cva, type VariantProps } from "class-variance-authority";

export const spinnerVariants = cva("animate-spin rounded-full border-muted border-t-accent", {
	variants: {
		size: {
			sm: "size-4 border-2",
			md: "size-6 border-4",
			lg: "size-8 border-4",
			xl: "size-10 border-4",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

export type SpinnerVariantProps = VariantProps<typeof spinnerVariants>;
