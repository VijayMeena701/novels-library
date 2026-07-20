"use client";
import { useEffect, type ReactNode } from 'react';
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface BottomSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
	header?: ReactNode;
	className?: string;
	contentClassName?: string;
	closeLabel?: string;
	showHandle?: boolean;
	showCloseButton?: boolean;
}

export function BottomSheet({
	isOpen,
	onOpenChange,
	children,
	header,
	className,
	contentClassName,
	closeLabel = "Close",
	showHandle = true,
	showCloseButton = true,
}: BottomSheetProps) {
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onOpenChange(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onOpenChange]);

	return (
		<>
			{isOpen && (
				<div
					className="fixed inset-0 z-30 bg-foreground/20 transition-opacity duration-300"
					role="presentation"
					aria-hidden="true"
					onClick={() => onOpenChange(false)}
				/>
			)}
			<div
				className={cn(
					"fixed inset-x-0 bottom-0 z-40 flex flex-col transition-transform duration-300 ease-out sm:left-auto sm:right-4 sm:bottom-4 sm:w-[min(100%,420px)]",
					isOpen ? "translate-y-0" : "translate-y-full",
					className,
				)}
			>
				<div className="flex flex-col rounded-t-2xl border border-border bg-surface/95 shadow-elevated backdrop-blur-md sm:rounded-b-2xl font-sans">
					<div className="flex items-center justify-between gap-2 px-3 py-2">
						<div className="flex flex-1 flex-col items-center gap-1 py-1">
							{showHandle && (
								<div className="h-1 w-10 rounded-full bg-muted-copy" />
							)}
							{showHandle && closeLabel && (
								<button
									type="button"
									onClick={() => onOpenChange(false)}
									className="text-[0.65rem] font-bold text-muted-copy hover:text-foreground transition"
								>
									{closeLabel}
								</button>
							)}
						</div>
						{showCloseButton && (
							<button
								type="button"
								onClick={() => onOpenChange(false)}
								aria-label="Close"
								className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-copy hover:bg-surface-muted hover:text-foreground transition"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
					{header && (
						<div className="border-t border-border px-3 py-2">{header}</div>
					)}
					<div className={cn("border-t border-border", contentClassName)}>{children}</div>
				</div>
			</div>
		</>
	);
}
