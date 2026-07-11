import React from "react";
import { cn } from "../../lib/utils";

export interface FieldProps {
	label: string;
	children: React.ReactNode;
	className?: string;
}

export function Field({ label, children, className }: FieldProps) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">{label}</span>
			{children}
		</div>
	);
}
