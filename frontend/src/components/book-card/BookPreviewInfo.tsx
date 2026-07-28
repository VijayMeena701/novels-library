'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, Globe, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Book } from '@/utils/api';

interface BookPreviewInfoProps {
  book: Book;
  authorName: string;
  totalChapters: number;
}

export function BookPreviewInfo({ book, authorName, totalChapters }: BookPreviewInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasLongSynopsis = (book.description?.length || 0) > 140;
  const synopsis =
    book.description ||
    'An extraordinary tale following the protagonist through trials of endurance, mastery, and unforeseen fate in a world filled with mystery.';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-2xl font-bold leading-tight tracking-tight text-primary">{book.title}</h3>
        <p className="mt-1 text-sm font-medium text-secondary">by {authorName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {typeof book.ratingAverage === 'number' && book.ratingAverage > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 font-semibold text-warning">
            <Star className="size-3.5 fill-warning text-warning" />
            {book.ratingAverage.toFixed(1)}
          </span>
        )}

        <span className="inline-flex items-center gap-1 text-secondary">
          <BookOpen className="size-3.5 text-accent" />
          {totalChapters || '?'} Chapters
        </span>

        {book.publicationStatus && (
          <Badge variant="default" className="rounded-full border border-default">
            {book.publicationStatus}
          </Badge>
        )}
      </div>

      {book.originalSource && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Globe className="size-3.5" />
          <span>Published by {book.originalSource}</span>
        </div>
      )}

      {book.genres && book.genres.length > 0 && (
        <div className="flex flex-wrap items-center gap-y-1 text-xs text-muted">
          {book.genres.map((genre, index) => (
            <span key={genre} className="inline-flex items-center">
              {genre}
              {index < book.genres.length - 1 && <span className="mx-2 text-muted/40">•</span>}
            </span>
          ))}
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">About this novel</span>
        <p className={cn('text-xs leading-relaxed text-secondary', !isExpanded && 'line-clamp-3')}>{synopsis}</p>
        {hasLongSynopsis && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent transition-colors hover:text-primary-hover"
          >
            {isExpanded ? 'Read less' : 'Read more'}
            <ChevronDown className={cn('size-3.5 transition-transform', isExpanded && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  );
}
