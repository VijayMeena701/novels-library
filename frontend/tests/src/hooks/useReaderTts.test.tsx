import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderTts } from '@/hooks/useReaderTts';
import type { PlaybackEngineName } from '@/lib/tts/playback';
import type { ChapterContent } from '@/utils/api';

const mockPlay = vi.fn();
const mockStop = vi.fn();
const mockPreload = vi.fn();
const mockSpeakKeepAlive = vi.fn();

vi.mock('@/hooks/usePlaybackManager', () => ({
  usePlaybackManager: () => ({
    play: mockPlay,
    stop: mockStop,
    preload: mockPreload,
    speakKeepAlive: mockSpeakKeepAlive,
    pause: vi.fn(),
    resume: vi.fn(),
    state: 'idle',
    voices: [],
    isSupported: true,
    engineName: 'local',
  }),
}));

function createProps(overrides: Partial<Parameters<typeof useReaderTts>[0]> = {}) {
  const container = document.createElement('div');
  container.innerHTML = '<p>Hello world. Extra text.</p><p>Second paragraph.</p>';
  document.body.appendChild(container);

  return {
    readerContentRef: { current: container },
    chapter: { content: container.innerHTML, chapterNumber: 1 } as unknown as ChapterContent,
    chapterNumber: 1,
    hasNextChapter: false,
    nextChapterNumber: 0,
    navigateToChapter: vi.fn(),
    autoOpenNext: false,
    rate: 1,
    pitch: 1,
    voiceURI: 'af_heart',
    pronunciationRules: [],
    highlightParagraph: true,
    paragraphHighlightColor: '#f5d67a',
    autoScrollDuringSpeech: false,
    autoScrollOffset: 0,
    autoScrollBehavior: 'smooth' as const,
    wordHighlightColor: '#f59e0b',
    highlightMode: 'word' as const,
    shouldResumeTtsFromRoute: false,
    loading: false,
    readerSettingsReady: true,
    authLoading: false,
    playbackEngineName: 'local' as PlaybackEngineName,
    allowLocalTts: true,
    ...overrides,
  };
}

describe('useReaderTts highlights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('highlights paragraph and word when boundary callbacks fire for local AI', async () => {
    const props = createProps();
    const { result } = renderHook(() => useReaderTts(props));

    let didStart = false;
    await act(async () => {
      didStart = result.current.startSpeechFromBlock(0, { fromUserGesture: true });
    });
    expect(didStart).toBe(true);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    const [, callbacks] = mockPlay.mock.calls[0];

    act(() => {
      callbacks.onStart();
    });

    const firstParagraph = props.readerContentRef.current?.querySelector('p');
    expect(firstParagraph?.getAttribute('data-tts-paragraph-active')).toBe('true');

    // Simulate a word boundary for "world" at normalized char index 6.
    act(() => {
      callbacks.onBoundary({ name: 'word', charIndex: 6 });
    });

    const highlightedWord = firstParagraph?.querySelector('span');
    expect(highlightedWord).not.toBeNull();
    expect(highlightedWord?.textContent).toBe('world');
  });
});
