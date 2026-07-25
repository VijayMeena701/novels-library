import { cva, type VariantProps } from "class-variance-authority";

export const badgeVariants = cva(
	"inline-flex min-h-5 max-w-full items-center truncate rounded-full px-2 py-0.5 text-[0.7rem] font-medium uppercase leading-none tracking-wide",
	{
		variants: {
			variant: {
				default: "bg-surface-raised text-secondary",
				outline: "border border-default bg-transparent text-secondary",
				reading: "bg-accent text-inverse border-accent",
				completed: "bg-success text-inverse border-success",
				hold: "bg-warning text-inverse border-warning",
				pending: "bg-warning text-inverse border-warning",
				dropped: "bg-danger text-inverse border-danger",
				failed: "bg-danger text-inverse border-danger",
				planning: "bg-premium text-inverse border-premium",
				processing: "bg-info text-inverse border-info animate-pulse",
				requires_manual_intervention: "bg-warning text-inverse border-warning",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
