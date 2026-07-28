'use client';

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ReaderControlBarProps {
  chapterNumber: number;
  totalChapters: number;
  hasPreviousChapter: boolean;
  hasNextChapter: boolean;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
  onPlay: () => void;
  onPause: () => void;
  speechStatus: 'idle' | 'playing' | 'paused';
  readingTimeMinutes?: number;
}

export function ReaderControlBar(props: ReaderControlBarProps) {
  const {
    chapterNumber,
    totalChapters,
    hasPreviousChapter,
    hasNextChapter,
    onPreviousChapter,
    onNextChapter,
    onPlay,
    onPause,
    speechStatus,
    readingTimeMinutes,
  } = props;

  const progress = totalChapters > 0 ? Math.round((chapterNumber / totalChapters) * 100) : 0;
  const isPlaying = speechStatus === 'playing';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-reader bg-reader-surface px-4 py-3 text-reader-paragraph shadow-elevation-5 backdrop-blur-md max-[860px]:py-2.5 sm:bottom-4 sm:left-1/2 sm:w-[min(680px,calc(100%-2rem))] sm:-translate-x-1/2 sm:rounded-2xl sm:border">
      <div className="mb-2 flex items-center justify-between gap-3 text-[0.7rem] font-semibold text-reader-muted">
        <span>Book progress</span>
        <span>{progress}%</span>
      </div>
      <div
        className="mb-2 h-1 overflow-hidden rounded-full bg-reader"
        role="progressbar"
        aria-label="Book progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-reader-accent transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPreviousChapter}
          disabled={!hasPreviousChapter}
          aria-label="Previous chapter"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.8rem] font-semibold text-reader-paragraph transition hover:bg-reader-controls disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SkipBack className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-2 text-center">
          <button
            type="button"
            onClick={() => (isPlaying ? onPause() : onPlay())}
            aria-label={isPlaying ? 'Pause' : 'Listen'}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-px active:scale-95',
              isPlaying
                ? 'bg-reader-accent text-reader-surface hover:bg-reader-accent-hover'
                : 'border border-reader bg-reader text-reader-paragraph hover:bg-reader-controls',
            )}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            <span>{isPlaying ? 'Pause' : 'Listen'}</span>
          </button>
          <span className="text-xs font-medium text-reader-muted">
            Chapter {chapterNumber} of {totalChapters}
            {typeof readingTimeMinutes === 'number' && readingTimeMinutes > 0
              ? ` · ${readingTimeMinutes} min read`
              : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={onNextChapter}
          disabled={!hasNextChapter}
          aria-label="Next chapter"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.8rem] font-semibold text-reader-paragraph transition hover:bg-reader-controls disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden sm:inline">Next</span>
          <SkipForward className="size-4" />
        </button>
      </div>
    </div>
  );
}
