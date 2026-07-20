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
					className="fixed inset-0 z-[51] bg-[var(--reader-overlay)] transition-opacity duration-300"
					role="presentation"
					aria-hidden="true"
					onClick={() => onOpenChange(false)}
				/>
			)}
			<div
				className={cn(
					"fixed inset-x-0 bottom-0 z-[55] flex flex-col font-sans transition-transform duration-300 ease-out sm:left-auto sm:right-4 sm:bottom-4 sm:w-[min(100%,440px)]",
					isOpen ? "pointer-events-auto translate-y-0" : "pointer-events-none translate-y-full",
					className,
				)}
			>
				<div className="flex flex-col rounded-t-2xl border border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text)] shadow-[0_18px_48px_rgba(0,0,0,0.24)] sm:rounded-b-2xl">
					<div className="flex items-center justify-between gap-2 px-4 py-2.5">
						<div className="flex flex-1 flex-col items-center gap-1 py-1">
							{showHandle && (
								<div className="h-1 w-10 rounded-full bg-[var(--reader-muted)]" />
							)}
							{showHandle && closeLabel && (
								<button
									type="button"
									onClick={() => onOpenChange(false)}
									className="text-[0.7rem] font-medium text-[var(--reader-muted)] transition hover:text-[var(--reader-text)]"
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
								className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--reader-muted)] transition hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
					{header && (
						<div className="border-t border-[var(--reader-border)] px-4 py-2.5">{header}</div>
					)}
					<div className={cn("border-t border-[var(--reader-border)]", contentClassName)}>{children}</div>
				</div>
			</div>
		</>
	);
}
