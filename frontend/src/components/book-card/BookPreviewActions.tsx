'use client';

import { Bookmark, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { PreviewReadButtonConfig } from './types';

interface BookPreviewActionsProps {
  readButton: PreviewReadButtonConfig;
  isBookmarked: boolean;
  isToggling: boolean;
  canToggleBookmark: boolean;
  onToggleBookmark?: (e?: React.MouseEvent) => void | Promise<void>;
}

export function BookPreviewActions({
  readButton,
  isBookmarked,
  isToggling,
  canToggleBookmark,
  onToggleBookmark,
}: BookPreviewActionsProps) {
  const ReadIcon = readButton.icon;

  return (
    <div className="flex items-center gap-3">
      {readButton.href ? (
        readButton.external ? (
          <Button asChild className="flex-1 rounded-xl">
            <a
              href={readButton.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2"
            >
              <ReadIcon className={`size-4 ${readButton.iconClass || ''}`} />
              {readButton.label}
            </a>
          </Button>
        ) : (
          <Button asChild className="flex-1 rounded-xl">
            <Link href={readButton.href} className="inline-flex w-full items-center justify-center gap-2">
              <ReadIcon className={`size-4 ${readButton.iconClass || ''}`} />
              {readButton.label}
            </Link>
          </Button>
        )
      ) : (
        <Button className="flex-1 rounded-xl" disabled>
          <ReadIcon className={`size-4 ${readButton.iconClass || ''}`} />
          {readButton.label}
        </Button>
      )}

      {canToggleBookmark && (
        <Button
          type="button"
          variant={isBookmarked ? 'default' : 'secondary'}
          size="icon"
          className="h-10 w-10 rounded-xl"
          onClick={onToggleBookmark}
          disabled={isToggling}
        >
          {isToggling ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Bookmark className={`size-4 ${isBookmarked ? 'fill-current' : ''}`} />
          )}
        </Button>
      )}
    </div>
  );
}
