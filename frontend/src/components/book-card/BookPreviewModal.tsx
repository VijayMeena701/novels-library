'use client';

import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getBookCoverUrl, type Book } from '@/utils/api';
import { BookPreviewActions } from './BookPreviewActions';
import { BookPreviewCover } from './BookPreviewCover';
import { BookPreviewInfo } from './BookPreviewInfo';
import { getPreviewReadButton } from './previewReadButton';
import { getAuthorName, getProgressPercent, getTotalChapters } from './utils';
import type { BookCardMode } from './types';

interface BookPreviewModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  isBookmarked?: boolean;
  isToggling?: boolean;
  canToggleBookmark?: boolean;
  onToggleBookmark?: (e?: React.MouseEvent) => void | Promise<void>;
  mode?: BookCardMode;
}

export function BookPreviewModal({
  book,
  isOpen,
  onClose,
  isBookmarked = false,
  isToggling = false,
  canToggleBookmark = false,
  onToggleBookmark,
  mode = 'profile',
}: BookPreviewModalProps) {
  const { user } = useAuth();

  if (!isOpen || !book) return null;

  const authorName = getAuthorName(book);
  const coverSrc = getBookCoverUrl(book);
  const isLibraryMode = mode === 'profile';
  const totalChapters = getTotalChapters(book);
  const progressPercent = getProgressPercent(book);

  const showProgress = Boolean(user && (isLibraryMode || book.userBookCreatedAt));

  const readButton = getPreviewReadButton({ book, user, isLibraryMode, totalChapters });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-default bg-card shadow-elevation-5 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 inline-flex items-center justify-center rounded-full bg-surface-raised/80 p-1.5 text-muted shadow-elevation-1 backdrop-blur-sm transition-colors hover:bg-surface hover:text-secondary"
          aria-label="Close preview"
        >
          <X className="size-5" />
        </button>

        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-12">
          <BookPreviewCover
            book={book}
            coverSrc={coverSrc}
            status={book.status}
            showProgress={showProgress}
            progressPercent={progressPercent}
            chaptersRead={book.chaptersRead}
            totalChapters={totalChapters}
          />

          <div className="flex flex-col justify-between sm:col-span-8">
            <BookPreviewInfo
              book={book}
              authorName={authorName}
              totalChapters={totalChapters}
            />

            <BookPreviewActions
              readButton={readButton}
              isBookmarked={isBookmarked}
              isToggling={isToggling}
              canToggleBookmark={canToggleBookmark}
              onToggleBookmark={onToggleBookmark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
