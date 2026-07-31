'use client';
import { Field } from '../../ui/field';
import { Slider } from '../../ui/slider';
import { SegmentedControl } from '../../ui/segmented-control';
import { ToggleRow } from '../../ui/toggle-row';
import { ColorField } from '../../ui/color-field';
import { Select } from '../../ui/input';
import { Spinner } from '../../ui/spinner';
import { getTheme } from '../../../design-system/themes';
import { ENGINE_OPTIONS } from './engine-options';
import type { PlaybackEngineName } from '../../../lib/tts/playback';
import type { ReaderBottomToolbarProps } from './types';

function ThemeDefaultSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.68rem] font-medium tracking-wide text-reader-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div className="size-9 shrink-0 rounded-lg border border-reader" style={{ backgroundColor: color }} />
        <span className="text-xs font-mono text-reader-muted">{color.toLowerCase()}</span>
      </div>
    </div>
  );
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2).replace(/\.?0+$/, '')}x`;
}

export function SpeechTab(props: ReaderBottomToolbarProps) {
  const engineOptions =
    props.localTtsEnabled === false ? ENGINE_OPTIONS.filter((option) => option.value !== 'local') : ENGINE_OPTIONS;

  const showEngineLoading = props.playbackEngine === 'local' && props.speechEngineLoading;
  const loadProgress = typeof props.speechEngineLoadProgress === 'number' ? props.speechEngineLoadProgress : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold text-reader-paragraph">Listening controls</h2>
        <p className="mt-1 text-xs leading-relaxed text-reader-muted">
          Tune the voice and optional highlights without leaving the chapter.
        </p>
      </div>
      <Field label="Playback engine" labelClassName="normal-case font-medium tracking-wide text-reader-muted">
        <Select
          value={props.playbackEngine}
          onChange={(event) => {
            const value = event.target.value as PlaybackEngineName;
            if (value !== 'cloud') {
              props.onPlaybackEngineChange(value);
            }
          }}
          className="min-h-10 border-reader bg-reader text-xs text-reader-paragraph focus:border-reader-accent focus:ring-reader-accent"
        >
          {engineOptions.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      {showEngineLoading && (
        <div
          className="flex items-start gap-3 rounded-xl border border-reader bg-reader p-3"
          role="status"
          aria-live="polite"
        >
          <Spinner size="sm" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-reader-paragraph">
              {loadProgress !== null ? `Downloading AI voice model — ${loadProgress}%` : 'Loading local AI voice…'}
            </p>
            <p className="mt-0.5 text-[0.68rem] leading-relaxed text-reader-muted">
              The first load downloads the speech model and can take a minute. Later loads start from cache.
            </p>
            {loadProgress !== null && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-reader-controls">
                <div
                  className="h-full rounded-full bg-reader-accent transition-[width] duration-300"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <Field label="Voice language profile" labelClassName="normal-case font-medium tracking-wide text-reader-muted">
        <Select
          value={props.voiceURI}
          onChange={(event) => props.onVoiceChange(event.target.value)}
          className="min-h-10 border-reader bg-reader text-xs text-reader-paragraph focus:border-reader-accent focus:ring-reader-accent"
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

      <Field label="Highlight mode" labelClassName="normal-case font-medium tracking-wide text-reader-muted">
        <SegmentedControl
          options={['off', 'paragraph', 'word']}
          value={props.highlightMode}
          onChange={props.onHighlightModeChange}
        />
      </Field>

      {props.highlightMode !== 'off' && (
        <div className="flex flex-col gap-3 rounded-xl border border-reader bg-reader p-3">
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
              <ColorField
                label="Paragraph Color"
                value={props.paragraphColor}
                onChange={props.onParagraphColorChange}
              />
              <ColorField label="Word Color" value={props.wordColor} onChange={props.onWordColorChange} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemeDefaultSwatch label="Paragraph" color={getTheme(props.theme)['reader.highlight']} />
              <ThemeDefaultSwatch label="Word" color={getTheme(props.theme)['reader.wordHighlight']} />
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
        <div className="flex flex-col gap-3 rounded-xl border border-reader bg-reader p-3">
          <Field label="Scroll smoothness" labelClassName="normal-case font-medium tracking-wide text-reader-muted">
            <SegmentedControl
              options={['smooth', 'instant']}
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
          className="w-full rounded-xl border border-reader bg-reader px-3 py-2.5 text-xs font-medium text-reader-paragraph transition hover:bg-reader-controls"
        >
          Pronunciation &amp; TTS Rules
        </button>
      )}
    </div>
  );
}
