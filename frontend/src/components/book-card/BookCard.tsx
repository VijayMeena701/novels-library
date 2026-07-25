'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { getBookCoverUrl } from '@/utils/api';
import { ProceduralCover } from './ProceduralCover';
import { StatusBadge } from './StatusBadge';
import { BookCardCoverOverlay } from './BookCardCoverOverlay';
import { BookPreviewModal } from './BookPreviewModal';
import { useLibraryToggle } from './useLibraryToggle';
import { getAuthorName, getProgressPercent, getTotalChapters } from './utils';
import type { BookCardProps } from './types';

export function BookCard({
  book,
  href,
  mode = 'profile',
}: BookCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { isBookmarked, isToggling, canToggleBookmark, handleBookmarkClick } = useLibraryToggle({
    bookId: book._id,
    inLibrary: Boolean(book.userBookCreatedAt),
  });

  const authorName = getAuthorName(book);
  const coverSrc = getBookCoverUrl(book);
  const totalChapters = getTotalChapters(book);
  const progressPercent = getProgressPercent(book);

  const isCatalog = mode === 'catalog';
  const detailHref = href || `/books/${book._id}`;

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPreviewOpen(true);
  };

  return (
    <>
      <div className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-strong bg-card shadow-elevation-2 transition-all duration-300 ease-out hover:shadow-elevation-4">
        <Link href={detailHref} className="flex min-h-0 flex-1 flex-col text-inherit no-underline">
          <div className="relative flex aspect-[3/4] min-h-[220px] items-center justify-center overflow-hidden bg-surface-raised">
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverSrc}
                alt={book.title}
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            ) : (
              <ProceduralCover book={book} />
            )}

            <BookCardCoverOverlay
              book={book}
              isBookmarked={isBookmarked}
              isToggling={isToggling}
              canToggle={canToggleBookmark}
              onPreview={handlePreviewClick}
              onToggleBookmark={handleBookmarkClick}
            />
          </div>

          <div className="flex flex-1 flex-col justify-between px-4 pt-1.5 pb-3">
            <div>
              <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-primary transition-colors group-hover:text-primary">
                {book.title}
              </h3>
              <p className="mt-0.5 truncate text-xs font-medium text-secondary">
                {authorName}
              </p>
            </div>

            <div className="mt-2 border-t border-default pt-2">
              {isCatalog ? (
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="inline-flex items-center gap-1 font-medium text-secondary">
                    <BookOpen className="size-3.5 text-accent" />
                    {totalChapters} Ch
                  </span>
                  <span className="truncate rounded bg-surface-raised px-2 py-0.5 text-[11px] text-muted">
                    {book.originalSource}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    {book.status && <StatusBadge status={book.status} />}
                    <span className="font-mono text-[11px] font-semibold text-secondary">
                      {progressPercent}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>

      <BookPreviewModal
        book={book}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        isBookmarked={isBookmarked}
        isToggling={isToggling}
        canToggleBookmark={canToggleBookmark}
        onToggleBookmark={handleBookmarkClick}
        mode={isCatalog ? 'catalog' : 'profile'}
      />
    </>
  );
}
