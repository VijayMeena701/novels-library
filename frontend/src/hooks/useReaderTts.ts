'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ChapterContent,
  type ReaderAutoScrollBehavior,
  type ReaderHighlightMode,
  type PronunciationRule,
} from '../utils/api';
import { type TtsStatus, type SpeechQueueItem, type SpeechBlock } from '../lib/tts/speechTypes';
import { findSpeechBlocks, createSpeechQueue } from '../lib/tts/speechQueue';
import {
  clearWordHighlight,
  clearParagraphHighlight,
  applyParagraphHighlight,
  highlightWordInBlock,
  updateWordHighlightColor,
  updateParagraphHighlightColor,
} from '../lib/tts/speechHighlight';
import { scrollToElement } from '../lib/tts/speechScroller';
import { TTS_SESSION_FLAG } from '../lib/reader-utils';
import { usePlaybackManager } from './usePlaybackManager';
import type { PlaybackEngineName, PlaybackBoundaryEvent } from '@/lib/tts/playback';

function getCharIndexInText(queueItem: SpeechQueueItem, spokenCharIndex: number): number {
  if (queueItem.spokenText === queueItem.text) return spokenCharIndex;
  if (!queueItem.text.length || !queueItem.spokenText.length) return 0;
  const ratio = spokenCharIndex / queueItem.spokenText.length;
  return Math.min(queueItem.text.length - 1, Math.floor(ratio * queueItem.text.length));
}

function findSegmentLocation(queueItem: SpeechQueueItem, charIndexInText: number) {
  for (const segment of queueItem.segments) {
    const start = segment.startOffset;
    const end = start + segment.text.length;
    if (charIndexInText >= start && charIndexInText < end) {
      const charIndexInSegment = charIndexInText - start;
      return {
        blockIndex: segment.blockIndex,
        charIndexInBlock: charIndexInSegment + segment.blockStartOffset,
        segment,
      };
    }
  }
  return null;
}

export interface UseReaderTtsReturn {
  ttsStatus: TtsStatus;
  speechError: string;
  play: () => void;
  pause: () => void;
  stop: (options?: { preserveContinuation?: boolean }) => void;
  startSpeechFromBlock: (
    startBlockIndex: number,
    options?: { continueAcrossChapters?: boolean; fromUserGesture?: boolean },
  ) => boolean;
  voices: { voiceURI: string; name: string; lang: string }[];
  voiceURI: string;
  setVoiceURI: (voiceURI: string) => void;
  isSupported: boolean;
  playbackEngineName: PlaybackEngineName;
}

export function useReaderTts({
  readerContentRef,
  chapter,
  chapterNumber,
  hasNextChapter,
  nextChapterNumber,
  navigateToChapter,
  autoOpenNext,
  rate,
  pitch,
  voiceURI,
  onVoiceChange,
  pronunciationRules,
  highlightParagraph,
  paragraphHighlightColor,
  autoScrollDuringSpeech,
  autoScrollOffset,
  autoScrollBehavior,
  wordHighlightColor,
  highlightMode,
  shouldResumeTtsFromRoute,
  loading,
  readerSettingsReady,
  authLoading,
  playbackEngineName,
  allowLocalTts,
}: {
  readerContentRef: React.RefObject<HTMLDivElement | null>;
  chapter: ChapterContent | null;
  chapterNumber: number;
  hasNextChapter: boolean;
  nextChapterNumber: number;
  navigateToChapter: (nextChapterNumber: number, options?: { resumeTts?: boolean }) => void;
  autoOpenNext: boolean;
  rate: number;
  pitch: number;
  voiceURI: string;
  onVoiceChange?: (voiceURI: string) => void;
  pronunciationRules: PronunciationRule[];
  highlightParagraph: boolean;
  paragraphHighlightColor: string;
  autoScrollDuringSpeech: boolean;
  autoScrollOffset: number;
  autoScrollBehavior: ReaderAutoScrollBehavior;
  wordHighlightColor: string;
  highlightMode: ReaderHighlightMode;
  shouldResumeTtsFromRoute: boolean;
  loading: boolean;
  readerSettingsReady: boolean;
  authLoading: boolean;
  playbackEngineName: PlaybackEngineName;
  allowLocalTts: boolean;
}): UseReaderTtsReturn {
  const speechStartTimerRef = useRef<number | null>(null);
  const playerStateRef = useRef({
    queue: [] as SpeechQueueItem[],
    index: 0,
    activeItem: null as SpeechQueueItem | null,
    blockIndex: null as number | null,
  });
  const speakQueuedChunkRef = useRef<(index: number) => void>(() => {});
  const ttsStatusRef = useRef<TtsStatus>('idle');
  const speechBlocksRef = useRef<SpeechBlock[]>([]);
  const domStateRef = useRef({
    activeElement: null as HTMLElement | null,
    wordWrapper: null as HTMLElement | null,
  });
  const hasUserInteractedRef = useRef(false);
  const shouldContinueSpeechRef = useRef(autoOpenNext);
  const startedAutoSpeechForChapterRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(TTS_SESSION_FLAG) === '1' && !hasUserInteractedRef.current) {
      hasUserInteractedRef.current = true;
    }
  }, []);

  useEffect(() => {
    shouldContinueSpeechRef.current = autoOpenNext;
  }, [autoOpenNext]);

  const markUserGesture = useCallback(() => {
    hasUserInteractedRef.current = true;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(TTS_SESSION_FLAG, '1');
    }
  }, []);
  const pronunciationRulesRef = useRef<PronunciationRule[]>(pronunciationRules);
  const styleRef = useRef({
    paragraphColor: paragraphHighlightColor,
    wordColor: wordHighlightColor,
  });
  const speechRestartTimerRef = useRef<number | null>(null);

  const [ttsStatus, setTtsStatus] = useState<TtsStatus>('idle');
  const [speechError, setSpeechError] = useState('');

  useEffect(() => {
    styleRef.current = { paragraphColor: paragraphHighlightColor, wordColor: wordHighlightColor };
  }, [paragraphHighlightColor, wordHighlightColor]);

  const effectivePlaybackEngineName = allowLocalTts
    ? playbackEngineName
    : playbackEngineName === 'local'
      ? 'system'
      : playbackEngineName;

  const playbackConfig = useMemo(() => ({ rate, pitch, voiceURI }), [rate, pitch, voiceURI]);
  const { play, speakKeepAlive, pause, resume, stop, preload, voices, isSupported } = usePlaybackManager({
    engineName: effectivePlaybackEngineName,
    config: playbackConfig,
  });

  const effectiveVoiceURI = useMemo(() => {
    if (!voiceURI || !voices.length) return voiceURI;
    if (voices.some((voice) => voice.voiceURI === voiceURI)) return voiceURI;
    const defaultVoice = voices.find((voice) => voice.lang.startsWith('en')) ?? voices[0];
    return defaultVoice?.voiceURI ?? voiceURI;
  }, [voices, voiceURI]);

  const setVoiceURI = useCallback(
    (voiceURI: string) => {
      onVoiceChange?.(voiceURI);
    },
    [onVoiceChange],
  );

  const buildSpeechBlocks = useCallback((): SpeechBlock[] => {
    return findSpeechBlocks(readerContentRef.current);
  }, [readerContentRef]);

  const getSpeechBlocks = useCallback((): SpeechBlock[] => {
    const root = readerContentRef.current;
    if (!root) return [];

    const isConnected = (element: HTMLElement) => element.isConnected && root.contains(element);
    if (speechBlocksRef.current.length > 0 && speechBlocksRef.current.every((block) => isConnected(block.element))) {
      return speechBlocksRef.current;
    }

    speechBlocksRef.current = buildSpeechBlocks();
    return speechBlocksRef.current;
  }, [buildSpeechBlocks, readerContentRef]);

  const clearSpeakingWord = useCallback(() => {
    if (domStateRef.current.wordWrapper) {
      clearWordHighlight(domStateRef.current.wordWrapper);
      domStateRef.current.wordWrapper = null;
    }
  }, []);

  const clearSpeakingHighlights = useCallback(() => {
    clearSpeakingWord();
    if (domStateRef.current.activeElement) {
      clearParagraphHighlight(domStateRef.current.activeElement);
      domStateRef.current.activeElement = null;
    }
  }, [clearSpeakingWord]);

  const highlightSpeechBlock = useCallback(
    (blockIndex: number, options?: { skipScroll?: boolean }) => {
      clearSpeakingHighlights();

      const blocks = getSpeechBlocks();
      const block = blocks[blockIndex];
      if (!block) {
        playerStateRef.current.blockIndex = null;
        return;
      }

      if (highlightParagraph) {
        applyParagraphHighlight(block.element, { color: styleRef.current.paragraphColor });
      }
      domStateRef.current.activeElement = block.element;

      if (options?.skipScroll) return;
      scrollToElement(block.element, {
        enabled: autoScrollDuringSpeech,
        offset: autoScrollOffset,
        behavior: autoScrollBehavior,
      });
    },
    [
      getSpeechBlocks,
      clearSpeakingHighlights,
      autoScrollDuringSpeech,
      autoScrollOffset,
      autoScrollBehavior,
      highlightParagraph,
    ],
  );

  const highlightSpeechWord = useCallback(
    (blockIndex: number, charIndexInBlock: number) => {
      clearSpeakingWord();

      const blocks = getSpeechBlocks();
      const block = blocks[blockIndex];
      if (!block || !block.element) return;

      const wrapper = highlightWordInBlock(block, charIndexInBlock, styleRef.current.wordColor);
      if (wrapper) {
        domStateRef.current.wordWrapper = wrapper;
      }
    },
    [getSpeechBlocks, clearSpeakingWord],
  );

  const isLocalEngine = effectivePlaybackEngineName === 'local';

  const createSpeechQueueFromBlock = useCallback(
    (startBlockIndex: number): SpeechQueueItem[] => {
      const maxChunkLength = isLocalEngine ? 280 : 1800;
      return createSpeechQueue(getSpeechBlocks(), startBlockIndex, pronunciationRulesRef.current, maxChunkLength, {
        combineBlocks: isLocalEngine,
      });
    },
    [getSpeechBlocks, isLocalEngine],
  );

  const stopSpeech = useCallback(
    (options?: { preserveContinuation?: boolean }) => {
      if (speechStartTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(speechStartTimerRef.current);
        speechStartTimerRef.current = null;
      }
      if (speechRestartTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(speechRestartTimerRef.current);
        speechRestartTimerRef.current = null;
      }
      if (!options?.preserveContinuation) {
        shouldContinueSpeechRef.current = false;
      }
      clearSpeakingHighlights();
      playerStateRef.current.blockIndex = null;
      playerStateRef.current.activeItem = null;
      ttsStatusRef.current = 'idle';
      setTtsStatus('idle');

      if (!options?.preserveContinuation) {
        stop();
      }
    },
    [clearSpeakingHighlights, stop],
  );

  const speakQueuedChunk = useCallback(
    (index: number) => {
      if (!isSupported) return;

      const speechItem = playerStateRef.current.queue[index];
      if (!speechItem) {
        playerStateRef.current.index = 0;
        playerStateRef.current.queue = [];
        playerStateRef.current.blockIndex = null;
        playerStateRef.current.activeItem = null;
        clearSpeakingHighlights();

        if (shouldContinueSpeechRef.current && hasNextChapter) {
          speakKeepAlive('Loading next chapter.');
          navigateToChapter(nextChapterNumber, { resumeTts: true });
        } else {
          playerStateRef.current.queue = [];
          playerStateRef.current.index = 0;
          playerStateRef.current.blockIndex = null;
          playerStateRef.current.activeItem = null;
          clearSpeakingHighlights();
          ttsStatusRef.current = 'idle';
          setTtsStatus('idle');
          shouldContinueSpeechRef.current = false;
        }
        return;
      }

      if (!speechItem.spokenText) {
        playerStateRef.current.index = index + 1;
        speakQueuedChunkRef.current(index + 1);
        return;
      }

      playerStateRef.current.activeItem = speechItem;

      const firstBlockIndex = speechItem.segments[0]?.blockIndex ?? speechItem.blockIndex;

      // System TTS starts speaking immediately, so highlight right away for
      // instant feedback. The local engine synthesizes asynchronously, so it
      // highlights from onStart instead to stay aligned with the audio.
      if (!isLocalEngine) {
        if (playerStateRef.current.blockIndex !== firstBlockIndex) {
          highlightSpeechBlock(firstBlockIndex);
        }
        playerStateRef.current.blockIndex = firstBlockIndex;
      }

      play(speechItem.spokenText, {
        onStart: () => {
          if (playerStateRef.current.blockIndex !== firstBlockIndex) {
            highlightSpeechBlock(firstBlockIndex);
          }
          playerStateRef.current.blockIndex = firstBlockIndex;
        },
        onEnd: () => {
          if (highlightMode === 'word') {
            clearSpeakingWord();
          }
          playerStateRef.current.index = index + 1;
          speakQueuedChunkRef.current(index + 1);
        },
        onBoundary: (event: PlaybackBoundaryEvent) => {
          const queueItem = playerStateRef.current.activeItem;
          if (!queueItem) return;

          const charIndexInText = getCharIndexInText(queueItem, event.charIndex);
          const location = findSegmentLocation(queueItem, charIndexInText);
          if (!location) return;

          if (playerStateRef.current.blockIndex !== location.blockIndex) {
            highlightSpeechBlock(location.blockIndex);
            playerStateRef.current.blockIndex = location.blockIndex;
          }

          if (highlightMode !== 'word') return;
          if (event.name && event.name !== 'word') return;

          highlightSpeechWord(location.blockIndex, location.charIndexInBlock);
        },
        onError: (error) => {
          console.error('Speech synthesis error:', error);
          if (error === 'not-allowed') {
            setSpeechError('Browser blocked autoplay. Press Play after tapping or clicking anywhere on the page.');
          } else {
            setSpeechError('Text to speech stopped in the browser.');
          }
          playerStateRef.current.activeItem = null;
          clearSpeakingHighlights();
          ttsStatusRef.current = 'idle';
          setTtsStatus('idle');
        },
      });

      for (let offset = 1; offset <= 3; offset++) {
        const nextItem = playerStateRef.current.queue[index + offset];
        if (nextItem?.spokenText) {
          preload(nextItem.spokenText);
        }
      }

      ttsStatusRef.current = 'playing';
      setTtsStatus('playing');
    },
    [
      play,
      preload,
      clearSpeakingHighlights,
      clearSpeakingWord,
      hasNextChapter,
      highlightMode,
      highlightSpeechBlock,
      highlightSpeechWord,
      isLocalEngine,
      isSupported,
      navigateToChapter,
      nextChapterNumber,
      speakKeepAlive,
    ],
  );

  useEffect(() => {
    speakQueuedChunkRef.current = speakQueuedChunk;
  }, [speakQueuedChunk]);

  const startSpeechFromBlock = useCallback(
    (startBlockIndex: number, options?: { continueAcrossChapters?: boolean; fromUserGesture?: boolean }): boolean => {
      if (!isSupported || typeof window === 'undefined') {
        setSpeechError('Text to speech is not available in this browser.');
        return false;
      }

      if (options?.fromUserGesture) {
        markUserGesture();
      }

      if (!hasUserInteractedRef.current && !options?.fromUserGesture) {
        setSpeechError('Press Play once after interacting with this page to enable browser speech playback.');
        return false;
      }

      const queue = createSpeechQueueFromBlock(startBlockIndex);
      if (queue.length === 0) {
        setSpeechError('There is no readable text to play.');
        return false;
      }

      shouldContinueSpeechRef.current = Boolean(options?.continueAcrossChapters);
      stop();
      playerStateRef.current.queue = queue;
      playerStateRef.current.index = 0;
      playerStateRef.current.blockIndex = null;
      playerStateRef.current.activeItem = null;
      setSpeechError('');

      if (speechStartTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(speechStartTimerRef.current);
        speechStartTimerRef.current = null;
      }

      speakQueuedChunkRef.current(0);
      return true;
    },
    [createSpeechQueueFromBlock, isSupported, stop, markUserGesture],
  );

  const restartSpeechFromCurrentBlock = useCallback(() => {
    if (!isSupported || typeof window === 'undefined') return;
    if (ttsStatusRef.current !== 'playing') return;

    const startBlockIndex = playerStateRef.current.blockIndex ?? 0;
    const continueAcrossChapters = shouldContinueSpeechRef.current;

    if (speechRestartTimerRef.current !== null) {
      window.clearTimeout(speechRestartTimerRef.current);
    }

    speechRestartTimerRef.current = window.setTimeout(() => {
      speechRestartTimerRef.current = null;
      if (ttsStatusRef.current !== 'playing') return;
      void startSpeechFromBlock(startBlockIndex, { continueAcrossChapters });
    }, 180);
  }, [isSupported, startSpeechFromBlock]);

  useEffect(() => {
    pronunciationRulesRef.current = pronunciationRules;
    if (ttsStatusRef.current === 'playing') {
      restartSpeechFromCurrentBlock();
    }
  }, [pronunciationRules, restartSpeechFromCurrentBlock]);

  useEffect(() => {
    if (ttsStatusRef.current === 'playing') {
      restartSpeechFromCurrentBlock();
    }
  }, [rate, pitch, voiceURI, restartSpeechFromCurrentBlock]);

  useEffect(() => {
    if (ttsStatusRef.current !== 'playing' || playerStateRef.current.blockIndex == null) return;
    const element = domStateRef.current.activeElement;
    if (!element || !element.isConnected || !highlightParagraph) {
      highlightSpeechBlock(playerStateRef.current.blockIndex, { skipScroll: true });
      return;
    }
    updateParagraphHighlightColor(element, paragraphHighlightColor);
  }, [paragraphHighlightColor, highlightParagraph, highlightSpeechBlock]);

  useEffect(() => {
    if (ttsStatusRef.current !== 'playing' || playerStateRef.current.blockIndex == null) return;
    highlightSpeechBlock(playerStateRef.current.blockIndex);
  }, [highlightParagraph, highlightSpeechBlock]);

  useEffect(() => {
    if (ttsStatusRef.current !== 'playing' || playerStateRef.current.blockIndex == null) return;
    highlightSpeechBlock(playerStateRef.current.blockIndex);
  }, [autoScrollDuringSpeech, autoScrollOffset, autoScrollBehavior, highlightSpeechBlock]);

  useEffect(() => {
    if (!domStateRef.current.wordWrapper) return;
    updateWordHighlightColor(domStateRef.current.wordWrapper, wordHighlightColor);
  }, [wordHighlightColor]);

  const handlePlaySpeech = useCallback(() => {
    if (!isSupported || typeof window === 'undefined') {
      setSpeechError('Text to speech is not available in this browser.');
      return;
    }

    if (ttsStatus === 'paused') {
      shouldContinueSpeechRef.current = autoOpenNext;
      resume();
      ttsStatusRef.current = 'playing';
      setTtsStatus('playing');
      return;
    }

    void startSpeechFromBlock(0, { continueAcrossChapters: autoOpenNext, fromUserGesture: true });
  }, [autoOpenNext, isSupported, startSpeechFromBlock, ttsStatus, resume]);

  const handlePauseSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && ttsStatus === 'playing') {
      pause();
      ttsStatusRef.current = 'paused';
      setTtsStatus('paused');
    }
  }, [ttsStatus, pause]);

  useEffect(() => {
    const shouldAutoStartSpeech = shouldResumeTtsFromRoute || shouldContinueSpeechRef.current;

    if (
      authLoading ||
      loading ||
      !readerSettingsReady ||
      !isSupported ||
      !chapter ||
      !shouldAutoStartSpeech ||
      startedAutoSpeechForChapterRef.current === chapterNumber ||
      (voiceURI && !voices.length)
    ) {
      return;
    }

    if (!hasUserInteractedRef.current) {
      setSpeechError('Browser requires one tap/click before auto-read can continue. Press Play to start.');
      return;
    }

    shouldContinueSpeechRef.current = true;
    const timer = window.setTimeout(() => {
      speechBlocksRef.current = buildSpeechBlocks();
      const didStart = startSpeechFromBlock(0, { continueAcrossChapters: true });
      if (didStart) {
        startedAutoSpeechForChapterRef.current = chapterNumber;
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    authLoading,
    chapter,
    chapterNumber,
    loading,
    readerSettingsReady,
    shouldResumeTtsFromRoute,
    isSupported,
    startSpeechFromBlock,
    buildSpeechBlocks,
    voices,
    voiceURI,
  ]);

  useEffect(() => {
    clearSpeakingHighlights();
    speechBlocksRef.current = [];
    playerStateRef.current.blockIndex = null;
    domStateRef.current.activeElement = null;
    domStateRef.current.wordWrapper = null;
  }, [chapter?.content, chapterNumber, clearSpeakingHighlights]);

  useEffect(() => {
    return () => {
      if (speechStartTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(speechStartTimerRef.current);
      }
      if (speechRestartTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(speechRestartTimerRef.current);
      }
      stopSpeech();
    };
  }, [stopSpeech]);

  return {
    ttsStatus,
    speechError,
    play: handlePlaySpeech,
    pause: handlePauseSpeech,
    stop: stopSpeech,
    startSpeechFromBlock,
    voices,
    voiceURI: effectiveVoiceURI,
    setVoiceURI,
    isSupported,
    playbackEngineName: effectivePlaybackEngineName,
  };
}
