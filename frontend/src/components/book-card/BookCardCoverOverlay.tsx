'use client';

import { Bookmark, BookOpen, Eye, Loader2, Star } from 'lucide-react';
import type { Book } from '@/utils/api';
import { getTotalChapters } from './utils';

interface BookCardCoverOverlayProps {
  book: Book;
  isBookmarked: boolean;
  isToggling: boolean;
  canToggle: boolean;
  onPreview: (e: React.MouseEvent) => void;
  onToggleBookmark: (e?: React.MouseEvent) => void | Promise<void>;
}

export function BookCardCoverOverlay({
  book,
  isBookmarked,
  isToggling,
  canToggle,
  onPreview,
  onToggleBookmark,
}: BookCardCoverOverlayProps) {
  const totalChapters = getTotalChapters(book);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 via-black/20 to-transparent p-2.5">
        {book.publicationStatus && (
          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md shadow-elevation-1">
            {book.publicationStatus}
          </span>
        )}

        {typeof book.ratingAverage === 'number' && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md shadow-elevation-1">
            <Star className="size-3 fill-white text-white" />
            {book.ratingAverage > 0
              ? Number.isInteger(book.ratingAverage)
                ? book.ratingAverage
                : book.ratingAverage.toFixed(1)
              : '–'}
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end gap-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-1 pb-2 pt-10">
        {totalChapters > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-white">
            <BookOpen className="size-3" />
            {totalChapters}
          </span>
        )}
        {book.originalSource && (
          <span className="inline-block max-w-[120px] truncate rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
            {book.originalSource}
          </span>
        )}
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-black shadow-lg transition-transform hover:scale-105 hover:bg-white"
        >
          <Eye className="size-3.5" /> View
        </button>

        {canToggle && (
          <button
            type="button"
            onClick={onToggleBookmark}
            disabled={isToggling}
            className={`rounded-full border p-2 backdrop-blur-md transition-transform hover:scale-105 disabled:opacity-60 ${
              isBookmarked
                ? 'border-accent bg-accent text-white'
                : 'border-white/20 bg-black/50 text-white hover:bg-black/70'
            }`}
          >
            {isToggling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Bookmark className={`size-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            )}
          </button>
        )}
      </div>
    </>
  );
}
