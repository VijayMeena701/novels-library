import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-button ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"bg-accent text-on-accent shadow-elevation-1 hover:bg-accent-hover hover:-translate-y-px hover:shadow-elevation-2",
				secondary:
					"bg-surface-raised text-primary border-default hover:bg-surface-hover",
				ghost:
					"bg-transparent text-primary hover:bg-surface-raised",
				outline:
					"bg-transparent text-primary border-default hover:bg-surface-raised",
				destructive:
					"bg-[var(--button-destructive-background)] text-[var(--button-destructive-foreground)] shadow-elevation-1 hover:bg-[var(--button-destructive-background-hover)]",
				success:
					"bg-[var(--button-success-background)] text-[var(--button-success-foreground)] shadow-elevation-1 hover:bg-[var(--button-success-background-hover)]",
				warning:
					"bg-[var(--button-warning-background)] text-[var(--button-warning-foreground)] shadow-elevation-1 hover:bg-[var(--button-warning-background-hover)]",
				reader:
					"bg-reader-surface text-accent border-reader hover:bg-reader-toolbar",
				floating:
					"bg-accent text-on-accent shadow-elevation-3 hover:bg-accent-hover hover:shadow-elevation-4",
				toolbar:
					"bg-transparent text-muted hover:bg-surface-raised hover:text-primary",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-8 px-3 text-xs",
				lg: "h-12 px-6 text-base",
				icon: "h-10 w-10 p-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
