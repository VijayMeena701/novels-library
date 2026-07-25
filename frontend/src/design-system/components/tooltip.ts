import { cva } from "class-variance-authority";

export const tooltipContentVariants = cva(
	"z-50 rounded-md border border-default bg-tooltip px-2 py-1 text-xs text-primary shadow-elevation-2",
);

export const tooltipArrowVariants = cva("fill-tooltip");
