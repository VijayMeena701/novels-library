"use client";
import { Field } from "../../ui/field";
import { Slider } from "../../ui/slider";
import { SegmentedControl } from "../../ui/segmented-control";
import { ToggleRow } from "../../ui/toggle-row";
import { ColorField } from "../../ui/color-field";
import { Select } from "../../ui/input";
import { getThemeTokens } from "../../../lib/reader-theme";
import type { ReaderBottomToolbarProps } from "./types";

function ThemeDefaultSwatch({ label, color }: { label: string; color: string }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-[0.68rem] font-medium tracking-wide text-[var(--reader-muted)]">{label}</span>
			<div className="flex items-center gap-2">
				<div
					className="size-9 shrink-0 rounded-lg border border-[var(--reader-border)]"
					style={{ backgroundColor: color }}
				/>
				<span className="text-xs font-mono text-[var(--reader-muted)]">{color.toLowerCase()}</span>
			</div>
		</div>
	);
}

function formatMultiplier(value: number): string {
	return `${value.toFixed(2).replace(/\.?0+$/, "")}x`;
}

export function SpeechTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="text-sm font-semibold text-[var(--reader-text)]">Listening controls</h2>
				<p className="mt-1 text-xs leading-relaxed text-[var(--reader-muted)]">Tune the voice and optional highlights without leaving the chapter.</p>
			</div>
			<Field label="Voice language profile" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
				<Select
					value={props.voiceURI}
					onChange={(event) => props.onVoiceChange(event.target.value)}
					className="min-h-10 border-[var(--reader-border)] bg-[var(--reader-bg)] text-xs text-[var(--reader-text)] focus:border-[var(--reader-accent)] focus:ring-[var(--reader-accent)]"
				>
					<option value="">System Default Voice</option>
					{props.voices.map((voice) => (
						<option key={voice.voiceURI} value={voice.voiceURI}>
							{voice.name} ({voice.lang})
						</option>
					))}
				</Select>
			</Field>

			<div className="grid gap-4 sm:grid-cols-2">
				<Slider
					label="Speech Rate"
					value={props.rate}
					min={0.5}
					max={3}
					step={0.05}
					onChange={props.onRateChange}
					formatValue={formatMultiplier}
				/>
				<Slider
					label="Tonal Pitch"
					value={props.pitch}
					min={0.5}
					max={2}
					step={0.05}
					onChange={props.onPitchChange}
					formatValue={formatMultiplier}
				/>
			</div>

			<ToggleRow
				label="Continue TTS into next chapter"
				checked={props.autoOpenNext}
				onChange={props.onAutoOpenNextChange}
			/>

			<Field label="Highlight mode" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
				<SegmentedControl
					options={["off", "paragraph", "word"]}
					value={props.highlightMode}
					onChange={props.onHighlightModeChange}
				/>
			</Field>

			{props.highlightMode !== "off" && (
				<div className="flex flex-col gap-3 rounded-xl border border-[var(--reader-border)] bg-[var(--reader-bg)] p-3">
					<ToggleRow
						label="Underline / Highlight paragraph"
						checked={props.highlightParagraph}
						onChange={props.onHighlightParagraphChange}
					/>
					<ToggleRow
						label="Use custom highlight colors"
						checked={props.useCustomHighlight}
						onChange={props.onUseCustomHighlightChange}
					/>
					{props.useCustomHighlight ? (
						<div className="grid gap-3 sm:grid-cols-2">
							<ColorField label="Paragraph Color" value={props.paragraphColor} onChange={props.onParagraphColorChange} />
							<ColorField label="Word Color" value={props.wordColor} onChange={props.onWordColorChange} />
						</div>
					) : (
						<div className="grid gap-3 sm:grid-cols-2">
							<ThemeDefaultSwatch label="Paragraph" color={getThemeTokens(props.theme).paragraphHighlight} />
							<ThemeDefaultSwatch label="Word" color={getThemeTokens(props.theme).wordHighlight} />
						</div>
					)}
					<Slider
						label="Highlight Emphasis"
						value={props.sentenceHighlightOpacity}
						min={0.05}
						max={0.6}
						step={0.01}
						onChange={props.onSentenceHighlightOpacityChange}
						formatValue={(value) => `${Math.round(value * 100)}%`}
					/>
				</div>
			)}

			<ToggleRow
				label="Auto-scroll to current line"
				checked={props.autoScrollDuringSpeech}
				onChange={props.onAutoScrollDuringSpeechChange}
			/>

			{props.autoScrollDuringSpeech && (
				<div className="flex flex-col gap-3 rounded-xl border border-[var(--reader-border)] bg-[var(--reader-bg)] p-3">
					<Field label="Scroll smoothness" labelClassName="normal-case font-medium tracking-wide text-[var(--reader-muted)]">
						<SegmentedControl
							options={["smooth", "instant"]}
							value={props.autoScrollBehavior}
							onChange={props.onAutoScrollBehaviorChange}
						/>
					</Field>
					<Slider
						label="Scroll offset buffer"
						value={props.autoScrollOffset}
						min={48}
						max={260}
						step={2}
						onChange={props.onAutoScrollOffsetChange}
						formatValue={(value) => `${Math.round(value)}px`}
					/>
				</div>
			)}

			{props.pronunciationRulesEnabled && props.onOpenPronunciationRules && (
				<button
					type="button"
					onClick={props.onOpenPronunciationRules}
					className="w-full rounded-xl border border-[var(--reader-border)] bg-[var(--reader-bg)] px-3 py-2.5 text-xs font-medium text-[var(--reader-text)] transition hover:bg-[var(--reader-surface-hover)]"
				>
					Pronunciation &amp; TTS Rules
				</button>
			)}
		</div>
	);
}
