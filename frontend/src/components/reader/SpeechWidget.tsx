"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Pause, Play, RotateCcw, Settings2, SkipBack, SkipForward, Square, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ReaderAutoScrollBehavior, ReaderHighlightMode } from "../../utils/api";

const WIDGET_WIDTH = 300;
const MIN_VISIBLE = 48;
const HIGHLIGHT_MODES = ["off", "paragraph", "word"] as const;
const SCROLL_BEHAVIORS = ["smooth", "instant"] as const;

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

	rate: number;
	onRateChange: (rate: number) => void;
	pitch: number;
	onPitchChange: (pitch: number) => void;

	autoNextChapter: boolean;
	onAutoNextChapterChange: (enabled: boolean) => void;

	highlightMode: ReaderHighlightMode;
	onHighlightModeChange: (mode: ReaderHighlightMode) => void;
	highlightParagraph: boolean;
	onHighlightParagraphChange: (enabled: boolean) => void;
	paragraphColor: string;
	onParagraphColorChange: (color: string) => void;
	wordColor: string;
	onWordColorChange: (color: string) => void;
	emphasis: number;
	onEmphasisChange: (value: number) => void;

	autoScroll: boolean;
	onAutoScrollChange: (enabled: boolean) => void;
	scrollBehavior: ReaderAutoScrollBehavior;
	onScrollBehaviorChange: (behavior: ReaderAutoScrollBehavior) => void;
	scrollOffset: number;
	onScrollOffsetChange: (value: number) => void;

	position: SpeechWidgetPosition;
	onPositionChange: (position: SpeechWidgetPosition, options?: { immediate?: boolean }) => void;
}

function clampPosition(position: SpeechWidgetPosition, viewportWidth: number, viewportHeight: number): SpeechWidgetPosition {
	const maxX = Math.max(8, viewportWidth - WIDGET_WIDTH - 8);
	const maxY = Math.max(8, viewportHeight - MIN_VISIBLE);
	return {
		x: Math.round(Math.min(maxX, Math.max(8, position.x))),
		y: Math.round(Math.min(maxY, Math.max(8, position.y))),
	};
}

function defaultPosition(viewportWidth: number, viewportHeight: number): SpeechWidgetPosition {
	return clampPosition(
		{ x: Math.max(24, viewportWidth - WIDGET_WIDTH - 24), y: Math.max(24, Math.round(viewportHeight * 0.15)) },
		viewportWidth,
		viewportHeight,
	);
}

function formatMultiplier(value: number): string {
	return `${value.toFixed(2).replace(/\.?0+$/, "")}x`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">{label}</span>
			{children}
		</div>
	);
}

function SliderField({
	label,
	value,
	min,
	max,
	step,
	onChange,
	formatValue,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	formatValue: (value: number) => string;
}) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between">
				<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">{label}</span>
				<span className="text-xs font-bold text-foreground">{formatValue(value)}</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-muted accent-primary"
			/>
		</div>
	);
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			aria-pressed={checked}
			className="flex items-center justify-between gap-3 text-left text-xs font-bold text-copy hover:opacity-95"
		>
			<span>{label}</span>
			<span
				className={cn(
					"relative inline-flex h-5 w-9 shrink-0 items-center rounded-lg border transition-colors duration-200",
					checked ? "border-primary bg-primary" : "border-border bg-surface",
				)}
			>
				<span
					className={cn(
						"inline-block size-3.5 transform rounded-lg bg-background shadow-card transition-transform duration-200",
						checked ? "translate-x-4" : "translate-x-1",
					)}
				/>
			</span>
		</button>
	);
}

function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (value: T) => void }) {
	return (
		<div className="grid auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-border">
			{options.map((option) => (
				<button
					key={option}
					type="button"
					onClick={() => onChange(option)}
					className={cn(
						"min-h-8 border-r border-border px-2 py-1 text-[0.68rem] font-bold capitalize last:border-r-0 transition-colors",
						value === option ? "bg-primary text-background" : "bg-surface text-copy hover:bg-surface-muted",
					)}
				>
					{option}
				</button>
			))}
		</div>
	);
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">{label}</span>
			<div className="flex items-center gap-1.5">
				<div className="relative size-8 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
					<input
						type="color"
						value={value}
						onChange={(event) => onChange(event.target.value)}
						className="absolute inset-[-4px] size-[calc(100%+8px)] cursor-pointer border-0 p-0"
					/>
				</div>
				<input
					type="text"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="min-h-8 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary focus:shadow-focus"
				/>
			</div>
		</div>
	);
}

function ControlButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className="flex min-h-10 items-center justify-center rounded-md border border-border bg-surface text-copy transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
		>
			{icon}
		</button>
	);
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
		rate,
		onRateChange,
		pitch,
		onPitchChange,
		autoNextChapter,
		onAutoNextChapterChange,
		highlightMode,
		onHighlightModeChange,
		highlightParagraph,
		onHighlightParagraphChange,
		paragraphColor,
		onParagraphColorChange,
		wordColor,
		onWordColorChange,
		emphasis,
		onEmphasisChange,
		autoScroll,
		onAutoScrollChange,
		scrollBehavior,
		onScrollBehaviorChange,
		scrollOffset,
		onScrollOffsetChange,
		position,
		onPositionChange,
	} = props;

	const [isOpen, setIsOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isCompact, setIsCompact] = useState(false);

	// Auto-open logic synchronized inside effect cleanly
	useEffect(() => {
		const shouldAutoOpen = status !== "idle" || Boolean(error);
		if (shouldAutoOpen && !isOpen) {
			setIsOpen(true);
		}
	}, [status, error]);

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

	const clearDragVisual = useCallback(() => {
		if (rafRef.current !== null) {
			window.cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (panelRef.current) {
			panelRef.current.style.transform = "";
		}
	}, []);

	const handleHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompact) return;
		const origin = typeof window !== "undefined" ? clampPosition(position, window.innerWidth, window.innerHeight) : position;
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

	const handleHeaderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompact) return;
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		// Keep dragging clamped inside the screen boundary actively on movement
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

	const handleHeaderPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompact) return;
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		const finalPosition =
			typeof window !== "undefined"
				? clampPosition({ x: drag.currentX, y: drag.currentY }, window.innerWidth, window.innerHeight)
				: { x: drag.currentX, y: drag.currentY };

		clearDragVisual();
		dragRef.current = null;
		onPositionChange(finalPosition, { immediate: true });
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	const handleHeaderPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isCompact) return;
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
	const statusDotClass = isPlaying ? "bg-emerald-500" : isPaused ? "bg-amber-500" : "bg-muted-copy";

	return (
		<>
			{/* Widget Toggle Button */}
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-label={isOpen ? "Hide listening controls" : "Show listening controls"}
				className={cn(
					"fixed bottom-24 right-4 z-40 flex size-12 items-center justify-center rounded-lg shadow-elevated border transition duration-200 hover:-translate-y-0.5 active:scale-95 max-[860px]:bottom-20 max-[860px]:right-3",
					isOpen
						? "bg-card border-border text-foreground hover:bg-card-hover"
						: "bg-primary border-transparent text-background hover:bg-primary-hover",
				)}
			>
				<span className={cn("absolute right-1 top-1 size-3 rounded-lg border-2 border-card", statusDotClass)} />
				{isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
			</button>

			{/* Widget Main Panel */}
			{isOpen && (
				<div
					ref={panelRef}
					className={cn(
						"fixed z-50 flex max-h-[75vh] w-[300px] max-w-[calc(100vw-24px)] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-3.5 text-foreground shadow-elevated scrollbar-thin",
						isCompact && "inset-x-3 bottom-24 max-h-[calc(100vh-160px)]",
					)}
					style={isCompact ? undefined : { left: safePosition.x, top: safePosition.y }}
				>
					{/* Header Drag Area */}
					<div
						className="flex cursor-grab items-center gap-2 active:cursor-grabbing max-[860px]:cursor-default max-[860px]:active:cursor-default py-1 select-none"
						onPointerDown={handleHeaderPointerDown}
						onPointerMove={handleHeaderPointerMove}
						onPointerUp={handleHeaderPointerUp}
						onPointerCancel={handleHeaderPointerCancel}
						onLostPointerCapture={handleHeaderPointerCancel}
					>
						<GripVertical className="size-4 shrink-0 text-muted-copy" />
						<span className={cn("size-2 shrink-0 rounded-lg", statusDotClass)} />
						<span className="flex-1 text-[0.7rem] uppercase font-extrabold tracking-wider text-copy">
							{status === "idle" ? "Ready" : isPaused ? "Paused" : "Reading Speech"}
						</span>

						{/* Settings Toggle Button */}
						<button
							type="button"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								setIsSettingsOpen((open) => !open);
							}}
							aria-label="Speech settings"
							aria-expanded={isSettingsOpen}
							className={cn(
								"flex size-7 shrink-0 items-center justify-center rounded-md border transition",
								isSettingsOpen ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-copy hover:text-foreground",
							)}
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
								setIsSettingsOpen(false);
							}}
							aria-label="Close listening controls"
							className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-copy hover:text-foreground"
						>
							<X className="size-4" />
						</button>
					</div>

					{/* Controller Action Row */}
					<div className="grid grid-cols-5 gap-1.5">
						<ControlButton onClick={onPrevChapter} disabled={!hasPrevChapter} icon={<SkipBack className="size-4" />} label="Previous chapter" />
						<ControlButton
							onClick={onPlay}
							disabled={!supported}
							icon={isPlaying ? <RotateCcw className="size-4" /> : <Play className="size-4 ml-0.5" />}
							label={isPaused ? "Resume" : isPlaying ? "Restart" : "Play"}
						/>
						<ControlButton onClick={onPause} disabled={!isPlaying} icon={<Pause className="size-4" />} label="Pause" />
						<ControlButton onClick={onStop} disabled={status === "idle"} icon={<Square className="size-3.5 fill-current" />} label="Stop" />
						<ControlButton onClick={onNextChapter} disabled={!hasNextChapter} icon={<SkipForward className="size-4" />} label="Next chapter" />
					</div>

					{/* Error Banner */}
					{error && (
						<p className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 px-2.5 py-2 text-[0.7rem] font-semibold text-red-600 dark:text-red-400">
							Error: {error}
						</p>
					)}

					{/* Settings Panel */}
					{isSettingsOpen && (
						<div className="flex flex-col gap-3.5 border-t border-border pt-3">
							<Field label="Voice Language Profile">
								<select
									value={voiceURI}
									onChange={(event) => onVoiceChange(event.target.value)}
									className="w-full text-xs bg-surface border border-border rounded-md p-2 text-foreground cursor-pointer focus:outline-none focus:border-primary focus:shadow-focus"
								>
									<option value="">System Default Voice</option>
									{voices.map((voice) => (
										<option key={voice.voiceURI} value={voice.voiceURI}>
											{voice.name} ({voice.lang})
										</option>
									))}
								</select>
							</Field>

							<SliderField
								label="Speech Rate (Speed)"
								value={rate}
								min={0.5}
								max={3}
								step={0.05}
								onChange={onRateChange}
								formatValue={formatMultiplier}
							/>
							<SliderField
								label="Tonal Pitch"
								value={pitch}
								min={0.5}
								max={2}
								step={0.05}
								onChange={onPitchChange}
								formatValue={formatMultiplier}
							/>

							<ToggleRow label="Auto-advance next chapter" checked={autoNextChapter} onChange={onAutoNextChapterChange} />

							<Field label="Highlight Mode">
								<SegmentedControl options={HIGHLIGHT_MODES} value={highlightMode} onChange={onHighlightModeChange} />
							</Field>

							{highlightMode !== "off" && (
								<div className="flex flex-col gap-3 rounded-md bg-surface-muted p-2 border border-border">
									<ToggleRow label="Underline / Highlight paragraph" checked={highlightParagraph} onChange={onHighlightParagraphChange} />
									<div className="grid grid-cols-2 gap-2">
										<ColorField label="Paragraph Color" value={paragraphColor} onChange={onParagraphColorChange} />
										<ColorField label="Word Color" value={wordColor} onChange={onWordColorChange} />
									</div>
									<SliderField
										label="Highlight Emphasis"
										value={emphasis}
										min={0.05}
										max={0.6}
										step={0.01}
										onChange={onEmphasisChange}
										formatValue={(value) => `${Math.round(value * 100)}%`}
									/>
								</div>
							)}

							<ToggleRow label="Auto-scroll to current line" checked={autoScroll} onChange={onAutoScrollChange} />

							{autoScroll && (
								<div className="flex flex-col gap-3 rounded-md bg-surface-muted p-2 border border-border">
									<Field label="Scroll action smoothness">
										<SegmentedControl options={SCROLL_BEHAVIORS} value={scrollBehavior} onChange={onScrollBehaviorChange} />
									</Field>
									<SliderField
										label="Scroll offset buffer"
										value={scrollOffset}
										min={48}
										max={260}
										step={2}
										onChange={onScrollOffsetChange}
										formatValue={(value) => `${Math.round(value)}px`}
									/>
								</div>
							)}

							<button
								type="button"
								onClick={() => {
									if (typeof window === "undefined") return;
									onPositionChange(defaultPosition(window.innerWidth, window.innerHeight), { immediate: true });
								}}
								className="w-full rounded-md border border-border px-2.5 py-2 text-xs font-bold text-copy hover:bg-surface-muted transition"
							>
								Reset Widget Position
							</button>
						</div>
					)}
				</div>
			)}
		</>
	);
}
