'use client';

import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Book } from '@/utils/api';

interface BookCardFooterProps {
  book: Book;
  action?: ReactNode;
  onProgressIncrement?: (e: React.MouseEvent) => void;
}

export function BookCardFooter({ book, action, onProgressIncrement }: BookCardFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-default/80 bg-surface/50 px-4 py-2 text-xs text-muted">
      <span className="truncate">
        {book.rawChaptersTotal > 0
          ? `${book.rawChaptersTotal} raw indexed`
          : `Updated ${new Date(book.updatedAt).toLocaleDateString()}`}
      </span>

      <div className="flex items-center gap-1.5">
        {action ? (
          action
        ) : onProgressIncrement ? (
          <button
            type="button"
            onClick={onProgressIncrement}
            title="Increment chapter read (+1)"
            className="inline-flex items-center gap-1 rounded-md bg-accent-subtle px-2 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/10"
          >
            <Plus className="size-3" /> +1 Ch
          </button>
        ) : null}
      </div>
    </div>
  );
}
