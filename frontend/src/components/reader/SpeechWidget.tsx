"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { GripVertical, Pause, Play, RotateCcw, Settings2, SkipBack, SkipForward, Square, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { IconButton } from "../ui/icon-button";
import { Field } from "../ui/field";
import { Select } from "../ui/input";

const WIDGET_WIDTH = 320;
const MIN_VISIBLE = 48;

export interface SpeechWidgetPosition {
	x: number;
	y: number;
}

export interface SpeechWidgetProps {
	supported: boolean;
	status: "idle" | "playing" | "paused";
	error?: string;

	onPlay: () => void;
	onPause: () => void;
	onStop: () => void;
	onPrevChapter: () => void;
	onNextChapter: () => void;
	hasPrevChapter: boolean;
	hasNextChapter: boolean;

	voices: SpeechSynthesisVoice[];
	voiceURI: string;
	onVoiceChange: (voiceURI: string) => void;

	position: SpeechWidgetPosition;
	onPositionChange: (position: SpeechWidgetPosition, options?: { immediate?: boolean }) => void;

	onOpenSettings: () => void;
	isBottomToolbarOpen?: boolean;
}

function clampPosition(position: SpeechWidgetPosition, viewportWidth: number, viewportHeight: number): SpeechWidgetPosition {
	const maxX = Math.max(8, viewportWidth - WIDGET_WIDTH - 8);
	const maxY = Math.max(8, viewportHeight - MIN_VISIBLE);
	return {
		x: Math.round(Math.min(maxX, Math.max(8, position.x))),
		y: Math.round(Math.min(maxY, Math.max(8, position.y))),
	};
}

interface DragState {
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
	currentX: number;
	currentY: number;
}

export function SpeechWidget(props: SpeechWidgetProps) {
	const {
		supported,
		status,
		error,
		onPlay,
		onPause,
		onStop,
		onPrevChapter,
		onNextChapter,
		hasPrevChapter,
		hasNextChapter,
		voices,
		voiceURI,
		onVoiceChange,
		position,
		onPositionChange,
		onOpenSettings,
		isBottomToolbarOpen,
	} = props;

	const [isOpen, setIsOpen] = useState(false);
	const [isCompact, setIsCompact] = useState(false);

	const panelRef = useRef<HTMLDivElement | null>(null);
	const dragRef = useRef<DragState | null>(null);
	const rafRef = useRef<number | null>(null);
	const positionRef = useRef(position);
	const onPositionChangeRef = useRef(onPositionChange);

	useEffect(() => {
		positionRef.current = position;
	}, [position]);

	useEffect(() => {
		onPositionChangeRef.current = onPositionChange;
	}, [onPositionChange]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const mediaQuery = window.matchMedia("(max-width: 860px)");
		const applyLayout = () => setIsCompact(mediaQuery.matches);
		applyLayout();
		mediaQuery.addEventListener?.("change", applyLayout);
		return () => mediaQuery.removeEventListener?.("change", applyLayout);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined" || isCompact) return;
		const handleResize = () => {
			const next = clampPosition(positionRef.current, window.innerWidth, window.innerHeight);
			onPositionChangeRef.current(next);
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [isCompact]);

	useEffect(() => {
		return () => {
			if (rafRef.current !== null && typeof window !== "undefined") {
				window.cancelAnimationFrame(rafRef.current);
			}
		};
	}, []);

	const clearDragRaf = useCallback(() => {
		if (rafRef.current !== null) {
			window.cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
	}, []);

	const clearDragVisual = useCallback(() => {
		clearDragRaf();
		if (panelRef.current) {
			panelRef.current.style.transform = "";
		}
	}, [clearDragRaf]);

	const handleHeaderPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		const rect = panelRef.current?.getBoundingClientRect();
		const origin = rect
			? { x: rect.left, y: rect.top }
			: typeof window !== "undefined"
				? clampPosition(position, window.innerWidth, window.innerHeight)
				: position;
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: origin.x,
			originY: origin.y,
			currentX: origin.x,
			currentY: origin.y,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handleHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		const currentRawX = drag.originX + event.clientX - drag.startX;
		const currentRawY = drag.originY + event.clientY - drag.startY;

		const maxBoundaryX = window.innerWidth - WIDGET_WIDTH - 8;
		const maxBoundaryY = window.innerHeight - 80;

		drag.currentX = Math.max(8, Math.min(maxBoundaryX, currentRawX));
		drag.currentY = Math.max(8, Math.min(maxBoundaryY, currentRawY));

		if (rafRef.current !== null) return;
		rafRef.current = window.requestAnimationFrame(() => {
			rafRef.current = null;
			if (!dragRef.current || !panelRef.current) return;
			const offsetX = dragRef.current.currentX - dragRef.current.originX;
			const offsetY = dragRef.current.currentY - dragRef.current.originY;
			panelRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
		});
	};

	const handleHeaderPointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		if (isCompact) {
			clearDragRaf();
			dragRef.current = null;
		} else {
			const finalPosition =
				typeof window !== "undefined"
					? clampPosition({ x: drag.currentX, y: drag.currentY }, window.innerWidth, window.innerHeight)
					: { x: drag.currentX, y: drag.currentY };
			clearDragVisual();
			dragRef.current = null;
			onPositionChange(finalPosition, { immediate: true });
		}
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	const handleHeaderPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		clearDragVisual();
		dragRef.current = null;
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	if (!supported) return null;

	const isPlaying = status === "playing";
	const isPaused = status === "paused";
	const safePosition = typeof window !== "undefined" ? clampPosition(position, window.innerWidth, window.innerHeight) : position;
	const statusDotClass = isPlaying ? "bg-success" : isPaused ? "bg-warning" : "bg-muted-copy";

	return (
		<>
			{/* Widget Toggle Button */}
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-label={isOpen ? "Hide listening controls" : "Show listening controls"}
				className={cn(
					"fixed bottom-28 right-4 z-40 flex size-10 items-center justify-center rounded-full border shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-0.5 active:scale-95 max-[860px]:bottom-[5.75rem] max-[860px]:right-3",
					isOpen
						? "border-[var(--reader-accent)] bg-[var(--reader-surface-hover)] text-[var(--reader-text)]"
						: "border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
				)}
			>
				<span className={cn("absolute right-2 top-2 size-2.5 rounded-full border-2 border-[var(--reader-bg)]", statusDotClass)} />
				{isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
			</button>

			{/* Widget Main Panel */}
			{isOpen && (
				<div
					ref={panelRef}
					className={cn(
						"fixed flex w-[320px] max-w-[calc(100vw-24px)] flex-col gap-3 rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-surface)] p-3.5 text-[var(--reader-text)] shadow-[0_18px_48px_rgba(0,0,0,0.24)] font-sans",
						isBottomToolbarOpen ? "z-40" : "z-50",
						isCompact ? "inset-x-3 bottom-24" : "max-h-[70vh] overflow-y-auto",
					)}
					style={isCompact ? undefined : { left: safePosition.x, top: safePosition.y }}
				>
					{/* Header Drag Area */}
					<div
						className="flex cursor-grab items-center gap-2 py-1 select-none active:cursor-grabbing"
						onPointerDown={handleHeaderPointerDown}
						onPointerMove={handleHeaderPointerMove}
						onPointerUp={handleHeaderPointerUp}
						onPointerCancel={handleHeaderPointerCancel}
						onLostPointerCapture={handleHeaderPointerCancel}
					>
						<GripVertical className="size-4 shrink-0 text-[var(--reader-muted)]" />
						<span className={cn("size-2 shrink-0 rounded-full", statusDotClass)} />
						<span className="flex-1 text-[0.7rem] font-semibold tracking-wide text-[var(--reader-text)]">
							{status === "idle" ? "Ready" : isPaused ? "Paused" : "Reading"}
						</span>

						{/* Settings Button (opens bottom toolbar) */}
						<button
							type="button"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								onOpenSettings();
							}}
							aria-label="Open reader settings"
							className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--reader-border)] text-[var(--reader-muted)] transition hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
						>
							<Settings2 className="size-4" />
						</button>

						{/* Close Button */}
						<button
							type="button"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								setIsOpen(false);
							}}
							aria-label="Close listening controls"
							className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--reader-border)] text-[var(--reader-muted)] transition hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
						>
							<X className="size-4" />
						</button>
					</div>

					{/* Error Banner */}
					{error && (
						<p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[0.7rem] font-semibold text-danger">
							Error: {error}
						</p>
					)}

					{/* Voice Selector */}
					<Field label="Voice" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
						<Select
							value={voiceURI}
							onChange={(event) => onVoiceChange(event.target.value)}
							className="min-h-10 border-[var(--reader-border)] bg-[var(--reader-bg)] text-xs text-[var(--reader-text)] focus:border-[var(--reader-accent)] focus:ring-[var(--reader-accent)]"
						>
							<option value="">System Default Voice</option>
							{voices.map((voice) => (
								<option key={voice.voiceURI} value={voice.voiceURI}>
									{voice.name} ({voice.lang})
								</option>
							))}
						</Select>
					</Field>

					{/* Controller Action Row */}
					<div className="grid grid-cols-5 gap-1.5">
						<IconButton onClick={onPrevChapter} disabled={!hasPrevChapter} icon={<SkipBack className="size-4" />} aria-label="Previous chapter" title="Previous chapter" />
						<IconButton
							onClick={onPlay}
							disabled={!supported}
							icon={isPlaying ? <RotateCcw className="size-4" /> : <Play className="size-4 ml-0.5" />}
							aria-label={isPaused ? "Resume" : isPlaying ? "Restart" : "Play"}
							title={isPaused ? "Resume" : isPlaying ? "Restart" : "Play"}
							variant="primary"
						/>
						<IconButton onClick={onPause} disabled={!isPlaying} icon={<Pause className="size-4" />} aria-label="Pause" title="Pause" />
						<IconButton onClick={onStop} disabled={status === "idle"} icon={<Square className="size-3.5 fill-current" />} aria-label="Stop" title="Stop" />
						<IconButton onClick={onNextChapter} disabled={!hasNextChapter} icon={<SkipForward className="size-4" />} aria-label="Next chapter" title="Next chapter" />
					</div>
				</div>
			)}
		</>
	);
}
