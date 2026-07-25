import { Sparkles } from 'lucide-react';
import type { Book } from '@/utils/api';
import { getAuthorName, getCoverStyle } from './utils';

export function ProceduralCover({ book }: { book: Book }) {
  const style = getCoverStyle(book);
  const authorName = getAuthorName(book);

  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden p-5 text-inverse"
      style={style}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-3 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />

      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full border border-white/10 bg-white/5" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full border border-white/10 bg-white/5" />

      <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-2.5">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-warning/80">
          <Sparkles className="size-3 text-warning" />
          {book.publicationStatus || 'Edition'}
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-inverse/50">
          {book.originalSource || 'Volume'}
        </span>
      </div>

      <div className="relative z-10 my-auto py-4">
        <strong className="line-clamp-3 block font-serif text-lg font-bold leading-snug tracking-tight text-inverse drop-shadow-md">
          {book.title}
        </strong>
        <div className="mt-2 h-0.5 w-8 rounded bg-gradient-to-r from-warning to-transparent" />
        <small className="mt-2 block line-clamp-1 text-xs font-medium italic text-inverse/80">
          {authorName}
        </small>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-mono text-inverse/60">
        <span>ARCHIVE</span>
        <span>#{book._id ? String(book._id).slice(-4) : '001'}</span>
      </div>
    </div>
  );
}
