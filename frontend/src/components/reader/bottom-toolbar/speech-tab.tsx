"use client";

import React from "react";
import { Field } from "../../ui/field";
import { Slider } from "../../ui/slider";
import { SegmentedControl } from "../../ui/segmented-control";
import { ToggleRow } from "../../ui/toggle-row";
import { ColorField } from "../../ui/color-field";
import { Select } from "../../ui/input";
import type { ReaderBottomToolbarProps } from "./types";

function formatMultiplier(value: number): string {
	return `${value.toFixed(2).replace(/\.?0+$/, "")}x`;
}

export function SpeechTab(props: ReaderBottomToolbarProps) {
	return (
		<div className="flex flex-col gap-4">
			<Field label="Voice Language Profile">
				<Select
					value={props.voiceURI}
					onChange={(event) => props.onVoiceChange(event.target.value)}
					className="min-h-10 text-xs"
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

			<Field label="Highlight Mode">
				<SegmentedControl
					options={["off", "paragraph", "word"]}
					value={props.highlightMode}
					onChange={props.onHighlightModeChange}
				/>
			</Field>

			{props.highlightMode !== "off" && (
				<div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-3">
					<ToggleRow
						label="Underline / Highlight paragraph"
						checked={props.highlightParagraph}
						onChange={props.onHighlightParagraphChange}
					/>
					<div className="grid gap-3 sm:grid-cols-2">
						<ColorField label="Paragraph Color" value={props.paragraphColor} onChange={props.onParagraphColorChange} />
						<ColorField label="Word Color" value={props.wordColor} onChange={props.onWordColorChange} />
					</div>
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
				<div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-3">
					<Field label="Scroll smoothness">
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
					className="w-full rounded-xl bg-surface-muted px-3 py-2.5 text-xs font-bold text-foreground hover:bg-surface transition"
				>
					Pronunciation &amp; TTS Rules
				</button>
			)}
		</div>
	);
}
