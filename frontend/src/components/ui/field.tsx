import { type ReactNode } from 'react';
import { cn } from "../../lib/utils";

export interface FieldProps {
	label: string;
	children: ReactNode;
	className?: string;
	labelClassName?: string;
}

export function Field({ label, children, className, labelClassName }: FieldProps) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<span className={cn("text-[0.65rem] font-black uppercase tracking-wider text-muted-copy", labelClassName)}>{label}</span>
			{children}
		</div>
	);
}
