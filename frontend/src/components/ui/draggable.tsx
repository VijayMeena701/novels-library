"use client";

import {
	useCallback,
	useEffect,
	useRef,
	type CSSProperties,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
} from "react";
import { cn } from "../../lib/utils";

const DEFAULT_PADDING = 8;
const DRAG_THRESHOLD = 4;

interface Size {
	width: number;
	height: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function clampDraggablePosition(
	position: { x: number; y: number },
	size: Size,
	padding = DEFAULT_PADDING,
): { x: number; y: number } {
	if (typeof window === "undefined") return position;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const maxX = Math.max(padding, viewportWidth - size.width - padding);
	const maxY = Math.max(padding, viewportHeight - size.height - padding);
	return {
		x: Math.round(clamp(position.x, padding, maxX)),
		y: Math.round(clamp(position.y, padding, maxY)),
	};
}

export interface DraggableProps extends Omit<React.HTMLAttributes<HTMLElement>, "onClick" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "style"> {
	as?: "div" | "button";
	position: { x: number; y: number };
	onPositionChange: (position: { x: number; y: number }, options?: { immediate?: boolean }) => void;
	onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
	handle?: string;
	disabled?: boolean;
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
}

export function Draggable({
	as = "div",
	position,
	onPositionChange,
	onClick,
	handle,
	disabled,
	children,
	className,
	style,
	...rest
}: DraggableProps) {
	const isButton = as === "button";
	const containerRef = useRef<HTMLElement | null>(null);
	const positionRef = useRef(position);
	const originRef = useRef(position);
	const onPositionChangeRef = useRef(onPositionChange);
	const startPointerRef = useRef<{ x: number; y: number } | null>(null);
	const sizeRef = useRef<Size>({ width: 0, height: 0 });
	const pointerIdRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const didDragRef = useRef(false);
	const originalTransitionRef = useRef<string>("");

	useEffect(() => {
		positionRef.current = position;
	}, [position]);

	useEffect(() => {
		onPositionChangeRef.current = onPositionChange;
	}, [onPositionChange]);

	const clearRaf = useCallback(() => {
		if (rafRef.current !== null) {
			window.cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
	}, []);

	const cleanup = useCallback(() => {
		clearRaf();
		if (containerRef.current) {
			containerRef.current.style.transform = "";
			containerRef.current.style.cursor = "";
			containerRef.current.style.transition = originalTransitionRef.current;
		}
		pointerIdRef.current = null;
		startPointerRef.current = null;
	}, [clearRaf]);

	useEffect(() => {
		return () => cleanup();
	}, [cleanup]);

	const handlePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLElement>) => {
			if (disabled) return;

			let targetElement: Element | null = null;
			const target = event.target;
			if (target instanceof Element) {
				targetElement = target;
			} else if (target instanceof Node) {
				targetElement = (target as Node).parentElement;
			}

			if (handle && targetElement && !targetElement.closest(handle)) return;

			const container = containerRef.current;
			if (!container) return;

			try {
				container.setPointerCapture(event.pointerId);
			} catch {
				// Pointer capture may not be available in all environments.
			}

			pointerIdRef.current = event.pointerId;
			startPointerRef.current = { x: event.clientX, y: event.clientY };
			originRef.current = positionRef.current;
			didDragRef.current = false;

			const rect = container.getBoundingClientRect();
			sizeRef.current = { width: rect.width, height: rect.height };

			originalTransitionRef.current = container.style.transition;
			container.style.transition = "none";
		},
		[handle, disabled],
	);

	const handlePointerMove = useCallback(
		(event: ReactPointerEvent<HTMLElement>) => {
			if (pointerIdRef.current === null || pointerIdRef.current !== event.pointerId) return;

			const start = startPointerRef.current;
			const container = containerRef.current;
			if (!start || !container) return;

			const dx = event.clientX - start.x;
			const dy = event.clientY - start.y;

			if (!didDragRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
				didDragRef.current = true;
				container.style.cursor = "grabbing";
			}

			const next = clampDraggablePosition(
				{ x: originRef.current.x + dx, y: originRef.current.y + dy },
				sizeRef.current,
			);

			if (rafRef.current !== null) return;
			rafRef.current = window.requestAnimationFrame(() => {
				rafRef.current = null;
				if (!containerRef.current) return;
				const translateX = next.x - originRef.current.x;
				const translateY = next.y - originRef.current.y;
				containerRef.current.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
			});
		},
		[],
	);

	const handlePointerUp = useCallback(
		(event: ReactPointerEvent<HTMLElement>) => {
			if (pointerIdRef.current === null || pointerIdRef.current !== event.pointerId) return;

			const container = containerRef.current;
			if (container && container.hasPointerCapture(event.pointerId)) {
				try {
					container.releasePointerCapture(event.pointerId);
				} catch {
					// Ignore release failures.
				}
			}

			clearRaf();

			if (container) {
				container.style.transform = "";
				container.style.cursor = "";
				container.style.transition = originalTransitionRef.current;
			}

			if (didDragRef.current && startPointerRef.current) {
				const start = startPointerRef.current;
				const dx = event.clientX - start.x;
				const dy = event.clientY - start.y;
				const next = clampDraggablePosition(
					{ x: originRef.current.x + dx, y: originRef.current.y + dy },
					sizeRef.current,
				);
				onPositionChangeRef.current(next, { immediate: true });
			}

			pointerIdRef.current = null;
			startPointerRef.current = null;
		},
		[clearRaf],
	);

	const handleClick = useCallback(
		(event: ReactMouseEvent<HTMLElement>) => {
			if (didDragRef.current) {
				event.preventDefault();
				event.stopPropagation();
				didDragRef.current = false;
				return;
			}
			if (onClick) {
				onClick(event);
			}
		},
		[onClick],
	);

	const Tag = (isButton ? "button" : "div") as "button" | "div";

	return (
		<Tag
			ref={containerRef as React.Ref<HTMLButtonElement & HTMLDivElement>}
			type={isButton ? "button" : undefined}
			{...rest}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onClick={handleClick}
			className={cn("fixed", !handle && "touch-none", className)}
			style={{ left: position.x, top: position.y, ...style }}
		>
			{children}
		</Tag>
	);
}
