"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardTitle } from "./card";

export interface ModalProps {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	title?: string;
	size?: "sm" | "md" | "lg" | "xl" | "full";
	className?: string;
	contentClassName?: string;
	showCloseButton?: boolean;
}

const sizeClass: Record<Exclude<ModalProps["size"], undefined>, string> = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	full: "max-w-2xl",
};

export function Modal({
	open,
	onClose,
	children,
	title,
	size = "md",
	className,
	contentClassName,
	showCloseButton = true,
}: ModalProps) {
	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className={cn(
				"fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-[2px]",
				className,
			)}
			role="presentation"
			onClick={onClose}
		>
			<Card
				className={cn(
					"w-full max-h-[90vh] flex flex-col overflow-hidden",
					sizeClass[size],
					contentClassName,
				)}
				onClick={(event) => event.stopPropagation()}
			>
				{(title || showCloseButton) && (
					<div className="flex items-start justify-between gap-3 p-4 border-b border-border">
						{title ? (
							<CardTitle className="text-base">{title}</CardTitle>
						) : (
							<span />
						)}
						{showCloseButton && (
							<button
								type="button"
								onClick={onClose}
								aria-label="Close"
								className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-copy hover:bg-surface-muted hover:text-foreground transition"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
				)}
				<div className="overflow-y-auto p-4">{children}</div>
			</Card>
		</div>
	);
}
