import type {
  ReaderAutoScrollBehavior,
  ReaderHighlightMode,
  ReaderTheme,
  ReaderWidth,
  SourceKind,
} from '../../../utils/api';
import type { PlaybackEngineName, PlaybackVoice } from '../../../lib/tts/playback';

export const TABS = ['read', 'display', 'speech', 'settings', 'more'] as const;
export type ReaderBottomToolbarTab = (typeof TABS)[number];

export interface ReaderBottomToolbarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;

  activeTab: ReaderBottomToolbarTab;
  onTabChange: (tab: ReaderBottomToolbarTab) => void;

  // Read tab
  onPreviousChapter: () => void;
  onNextChapter: () => void;
  onOpenCatalog: () => void;
  hasPreviousChapter: boolean;
  hasNextChapter: boolean;
  previousChapterNumber: number;
  nextChapterNumber: number;
  catalogItemsLength: number;
  bookId: string;
  bookTitle: string;

  // Display tab
  theme: ReaderTheme;
  onThemeChange: (theme: ReaderTheme) => void;
  fontSize: number;
  onFontSizeDecrease: () => void;
  onFontSizeIncrease: () => void;
  readWidth: ReaderWidth;
  onReadWidthChange: (width: ReaderWidth) => void;

  // Speech tab
  playbackEngine: PlaybackEngineName;
  onPlaybackEngineChange: (engine: PlaybackEngineName) => void;
  localTtsEnabled?: boolean;
  /** True while the selected engine initializes (e.g. local AI model download). */
  speechEngineLoading?: boolean;
  /** Model download percentage (0-99) while loading, or null when indeterminate. */
  speechEngineLoadProgress?: number | null;
  voices: PlaybackVoice[];
  voiceURI: string;
  onVoiceChange: (voiceURI: string) => void;
  rate: number;
  onRateChange: (rate: number) => void;
  pitch: number;
  onPitchChange: (pitch: number) => void;
  highlightMode: ReaderHighlightMode;
  onHighlightModeChange: (mode: ReaderHighlightMode) => void;
  highlightParagraph: boolean;
  onHighlightParagraphChange: (enabled: boolean) => void;
  useCustomHighlight: boolean;
  onUseCustomHighlightChange: (enabled: boolean) => void;
  paragraphColor: string;
  onParagraphColorChange: (color: string) => void;
  wordColor: string;
  onWordColorChange: (color: string) => void;
  sentenceHighlightOpacity: number;
  onSentenceHighlightOpacityChange: (value: number) => void;
  autoScrollDuringSpeech: boolean;
  onAutoScrollDuringSpeechChange: (enabled: boolean) => void;
  autoScrollBehavior: ReaderAutoScrollBehavior;
  onAutoScrollBehaviorChange: (behavior: ReaderAutoScrollBehavior) => void;
  autoScrollOffset: number;
  onAutoScrollOffsetChange: (value: number) => void;
  pronunciationRulesEnabled?: boolean;
  onOpenPronunciationRules?: () => void;

  // Settings tab
  isRawReader: boolean;
  readerSourceKind: SourceKind;
  switchReaderSource: (source: SourceKind) => void;
  autoOpenNext: boolean;
  onAutoOpenNextChange: (enabled: boolean) => void;
  hasRawChapters: boolean;

  // More tab
  sourceUrl?: string;
  onScrollToTop: () => void;
  isLoggedIn: boolean;
}
