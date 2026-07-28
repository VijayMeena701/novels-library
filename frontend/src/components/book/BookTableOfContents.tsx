'use client';

import Link from 'next/link';
import type { Book, ChapterContent } from '../../utils/api';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import type { CatalogItem } from './book-details-helpers';

interface BookTableOfContentsProps {
  book: Book;
  chapters: Omit<ChapterContent, 'content'>[];
  sortedItems: CatalogItem[];
  chapterSearch: string;
  chapterSort: 'asc' | 'desc';
  onSearchChange: (val: string) => void;
  onSortToggle: () => void;
}

export function BookTableOfContents({
  book,
  chapters,
  sortedItems,
  chapterSearch,
  chapterSort,
  onSearchChange,
  onSortToggle,
}: BookTableOfContentsProps) {
  return (
    <Card className="p-[1.1rem] bg-surface border-default flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-3">
        <div>
          <h2 className="text-base font-bold text-primary">Table of Contents</h2>
          <p className="text-xs text-secondary mt-0.5">
            Archived translated: {chapters.length} / {book.translatedChaptersTotal || sortedItems.length || '?'}{' '}
            chapters.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search chapters..."
            value={chapterSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-40 h-8 bg-input-bg border border-input rounded-md px-2.5 text-xs outline-none transition-all duration-150 focus:bg-input-bg-focus focus:border-focus focus:ring-4 focus:ring-focus/20"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onSortToggle}
            className="h-8 text-xs font-semibold px-2.5 border-default hover:bg-surface-hover"
          >
            {chapterSort === 'asc' ? 'oldest' : 'newest'}
          </Button>
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <p className="text-sm text-secondary mt-2">
          {chapters.length === 0 ? (
            <span>
              No translated chapters have been indexed yet.
              {book.sourceUrl && (
                <>
                  {' '}
                  <a
                    href={book.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline font-bold"
                  >
                    Open source page
                  </a>
                  .
                </>
              )}
            </span>
          ) : (
            'No chapters match your search.'
          )}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[520px] overflow-y-auto pr-1">
            {sortedItems.slice(0, 120).map((chapterItem) => (
              <Link
                key={chapterItem.chapterNumber}
                href={`/books/${book._id}/reader/${chapterItem.chapterNumber}`}
                className={`grid gap-1 p-3 border border-default rounded-md transition-all duration-150 ${
                  chapterItem.archived
                    ? 'bg-surface-raised hover:bg-surface hover:border-strong'
                    : 'bg-surface-sunken/40 hover:bg-surface-raised opacity-75 hover:opacity-100'
                }`}
              >
                <span className="text-[10px] font-black text-muted uppercase">Chapter {chapterItem.chapterNumber}</span>
                <strong className="text-xs font-bold text-primary truncate">{chapterItem.title}</strong>
                {!chapterItem.archived && (
                  <small className="text-[9px] font-semibold text-muted uppercase">Indexed only</small>
                )}
              </Link>
            ))}
          </div>
          {sortedItems.length > 120 && (
            <p className="text-xs text-muted text-center mt-3 border-t border-subtle pt-3">
              Showing first 120 chapters. Use the search box above to locate specific numbers.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
