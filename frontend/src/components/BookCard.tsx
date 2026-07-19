import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { getBookCoverUrl, Book } from '../utils/api';
import { Badge } from './ui/badge';
import { Card, CardFooter } from './ui/card';

const COVER_PALETTES = [
  ['#405f8f', '#202a3d', '#b65f3d'],
  ['#7d3f5c', '#241f35', '#c0893d'],
  ['#2f6f73', '#1f2937', '#d08a48'],
  ['#6c5a2e', '#263225', '#8e5a9f'],
  ['#9b4d3d', '#2f2430', '#3e6c8e'],
  ['#4d628f', '#282a2f', '#b98748'],
  ['#5c6f41', '#202820', '#bf6f45'],
  ['#6d4b7e', '#25243c', '#4d8795'],
];

function getCoverStyle(book: Book): CSSProperties {
  const seed = `${book._id}${book.title}`;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [a, b, c] = COVER_PALETTES[hash % COVER_PALETTES.length];

  return {
    '--cover-a': a,
    '--cover-b': b,
    '--cover-c': c,
    background: `linear-gradient(160deg, rgba(19, 23, 32, 0.02), rgba(19, 23, 32, 0.76)), radial-gradient(circle at 18% 16%, rgba(255, 255, 255, 0.2), transparent 25%), radial-gradient(circle at 84% 14%, rgba(255, 255, 255, 0.12), transparent 22%), linear-gradient(135deg, ${a}, ${b} 56%, ${c})`,
  } as CSSProperties;
}

function getStatusBadgeVariant(status: string) {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');

  if (normalized === 'completed') return 'completed';
  if (normalized === 'reading') return 'reading';
  if (normalized === 'on_hold' || normalized === 'pending') return 'hold';
  if (normalized === 'dropped' || normalized === 'failed') return 'dropped';
  if (normalized === 'planning') return 'planning';
  if (normalized === 'processing') return 'processing';

  return 'default';
}

export function BookCard({
  book,
  action,
  href,
  mode = 'profile',
}: {
  book: Book;
  action?: ReactNode;
  href?: string;
  mode?: 'profile' | 'catalog';
}) {
  const coverSrc = getBookCoverUrl(book);
  const authorName = book.authorPenName || book.author || book.authorRealName || 'Unknown Author';
  const progress = book.translatedChaptersTotal > 0
    ? Math.min(100, Math.round((book.chaptersRead / book.translatedChaptersTotal) * 100))
    : 0;
  const isCatalog = mode === 'catalog';

  const detailHref = href || `/books/${book._id}`;

  return (
    <Card className="group flex h-full min-w-0 flex-col overflow-hidden transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
      <Link href={detailHref} className="flex min-h-0 flex-1 flex-col text-inherit no-underline">
        <div className="flex aspect-[3/4] min-h-[230px] items-center justify-center overflow-hidden border-b border-border bg-surface-muted">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" src={coverSrc} alt={book.title} />
          ) : (
            <div
              className="relative flex h-full w-full flex-col justify-end gap-[0.45rem] p-4 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.28)] before:pointer-events-none before:absolute before:left-[0.65rem] before:top-[0.7rem] before:bottom-[0.7rem] before:w-[3px] before:rounded-full before:bg-white/35"
              style={getCoverStyle(book)}
            >
              <span className="self-start max-w-full overflow-hidden whitespace-nowrap text-ellipsis rounded-full border border-white/30 px-[0.45rem] py-[0.2rem] text-[0.62rem] font-extrabold uppercase text-white/90">
                {(book.genres || [])[0] || book.publicationStatus || 'Book'}
              </span>
              <strong className="line-clamp-3 text-[1.08rem] font-black leading-[1.18] text-white">
                {book.title}
              </strong>
              <small className="block truncate text-[0.76rem] text-white/[0.78]">
                {authorName}
              </small>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-4 py-3">
          <div>
            <h3 className="line-clamp-2 break-words text-base font-extrabold leading-snug text-foreground">{book.title}</h3>
            <p className="mt-1 truncate text-sm text-copy">{authorName}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {isCatalog ? (
              book.publicationStatus && <Badge>{book.publicationStatus}</Badge>
            ) : (
              <Badge variant={getStatusBadgeVariant(book.status)}>{book.status.replace('_', ' ')}</Badge>
            )}
            {!isCatalog && book.publicationStatus && <Badge>{book.publicationStatus}</Badge>}
            {(book.genres || []).slice(0, 2).map((genre) => (
              <Badge key={genre}>{genre}</Badge>
            ))}
          </div>

          {isCatalog ? (
            <div className="mt-auto flex justify-between gap-2 text-xs text-copy">
              <span>{book.translatedChaptersTotal || book.translatedChaptersList?.length || '?'} chapters</span>
              <span className="truncate">{book.originalSource || 'Translated'}</span>
            </div>
          ) : (
            <div>
              <div className="mb-1 flex justify-between gap-2 text-xs text-copy">
                <span>Progress</span>
                <span>{book.chaptersRead} / {book.translatedChaptersTotal || '?'} ch</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#e8dfd1]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

        </div>
      </Link>

      <CardFooter className="mt-auto px-4 py-3">
        <span>
          {book.rawChaptersTotal > 0 ? `${book.rawChaptersTotal} raw indexed` : `Updated ${new Date(book.updatedAt).toLocaleDateString()}`}
        </span>
        {action}
      </CardFooter>
    </Card>
  );
}
