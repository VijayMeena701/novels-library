'use client';

import { cn } from '@/lib/utils';
import { getStatusConfig } from './utils';
import { ProgressBar } from './ProgressBar';
import { ProceduralCover } from './ProceduralCover';
import type { Book } from '@/utils/api';

interface BookPreviewCoverProps {
  book: Book;
  coverSrc: string;
  status?: string;
  showProgress: boolean;
  progressPercent: number;
  chaptersRead: number;
  totalChapters: number;
}

function StatusLabel({ status }: { status: string }) {
  const config = getStatusConfig(status);
  const label = status?.toLowerCase() === 'reading' ? 'Currently Reading' : config.label;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary">
      <span className={cn('size-2 rounded-full', config.dotClass)} />
      {label}
    </span>
  );
}

export function BookPreviewCover({
  book,
  coverSrc,
  status,
  showProgress,
  progressPercent,
  chaptersRead,
  totalChapters,
}: BookPreviewCoverProps) {
  return (
    <div className="flex flex-col items-center gap-4 sm:col-span-4 sm:items-start">
      <div className="relative aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-lg border border-default bg-surface-raised shadow-xl">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt={book.title} className="h-full w-full object-cover" />
        ) : (
          <ProceduralCover book={book} />
        )}
      </div>

      {showProgress && (
        <div className="w-full max-w-[200px] rounded-xl border border-default bg-surface p-4 shadow-elevation-2">
          <div className="mb-3 flex items-center justify-between">
            {status ? (
              <StatusLabel status={status} />
            ) : (
              <span className="text-xs font-semibold text-muted">Progress</span>
            )}
            <span className="text-xs font-bold text-secondary">{progressPercent}%</span>
          </div>

          <ProgressBar percent={progressPercent} size="md" variant="solid" className="mb-3" />

          <span className="block text-[11px] font-medium text-muted">
            {chaptersRead} of {totalChapters || '?'} chapters
          </span>
        </div>
      )}
    </div>
  );
}
