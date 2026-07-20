"use client";
import { useMemo, useState } from "react";
import { GripVertical, Pause, Play, RotateCcw, Settings2, SkipBack, SkipForward, Square, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { IconButton } from "../ui/icon-button";
import { Field } from "../ui/field";
import { Select } from "../ui/input";
import { Draggable } from "../ui/draggable";

const WIDGET_WIDTH = 320;
const WIDGET_MIN_VISIBLE = 48;
const TOGGLE_SIZE = 40;

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

	togglePosition: SpeechWidgetPosition;
	onTogglePositionChange: (position: SpeechWidgetPosition, options?: { immediate?: boolean }) => void;

	onOpenSettings: () => void;
	isBottomToolbarOpen?: boolean;
}

function clampPosition(
	position: SpeechWidgetPosition,
	viewportWidth: number,
	viewportHeight: number,
	width: number,
	minVisible: number,
): SpeechWidgetPosition {
	const maxX = Math.max(8, viewportWidth - width - 8);
	const maxY = Math.max(8, viewportHeight - minVisible);
	return {
		x: Math.round(Math.min(maxX, Math.max(8, position.x))),
		y: Math.round(Math.min(maxY, Math.max(8, position.y))),
	};
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
		togglePosition,
		onTogglePositionChange,
		onOpenSettings,
		isBottomToolbarOpen,
	} = props;

	const [isOpen, setIsOpen] = useState(false);

	const isPlaying = status === "playing";
	const isPaused = status === "paused";
	const statusDotClass = isPlaying ? "bg-success" : isPaused ? "bg-warning" : "bg-muted-copy";

	const safePanelPosition = useMemo(() => {
		if (typeof window === "undefined") return position;
		return clampPosition(position, window.innerWidth, window.innerHeight, WIDGET_WIDTH, WIDGET_MIN_VISIBLE);
	}, [position]);

	const safeTogglePosition = useMemo(() => {
		if (typeof window === "undefined") return togglePosition;
		return clampPosition(togglePosition, window.innerWidth, window.innerHeight, TOGGLE_SIZE, TOGGLE_SIZE);
	}, [togglePosition]);

	if (!supported) return null;

	return (
		<>
			{/* Widget Toggle Button */}
			<Draggable
				as="button"
				position={safeTogglePosition}
				onPositionChange={onTogglePositionChange}
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-label={isOpen ? "Hide listening controls" : "Show listening controls"}
				className={cn(
					"z-40 flex size-10 cursor-grab items-center justify-center rounded-full border shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-0.5 active:cursor-grabbing active:scale-95",
					isOpen
						? "border-[var(--reader-accent)] bg-[var(--reader-surface-hover)] text-[var(--reader-text)]"
						: "border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
				)}
			>
				<span className={cn("absolute right-2 top-2 size-2.5 rounded-full border-2 border-[var(--reader-bg)]", statusDotClass)} />
				{isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
			</Draggable>

			{/* Widget Main Panel */}
			{isOpen && (
				<Draggable
					as="div"
					position={safePanelPosition}
					onPositionChange={onPositionChange}
					handle="[data-speech-widget-header]"
					className={cn(
						"flex w-[320px] max-w-[calc(100vw-24px)] flex-col gap-3 rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-surface)] p-3.5 text-[var(--reader-text)] shadow-[0_18px_48px_rgba(0,0,0,0.24)] font-sans",
						isBottomToolbarOpen ? "z-40" : "z-50",
						"max-h-[70vh] overflow-y-auto",
					)}
				>
					{/* Header Drag Area */}
					<div
						data-speech-widget-header
						className="flex cursor-grab touch-none items-center gap-2 py-1 select-none active:cursor-grabbing"
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
				</Draggable>
			)}
		</>
	);
}
