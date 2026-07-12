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

function getCoverPalette(book: Book): CSSProperties {
  const seed = `${book._id}${book.title}`;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [a, b, c] = COVER_PALETTES[hash % COVER_PALETTES.length];

  return {
    '--cover-a': a,
    '--cover-b': b,
    '--cover-c': c,
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
  const progress = book.translatedUnitsTotal > 0
    ? Math.min(100, Math.round((book.unitsRead / book.translatedUnitsTotal) * 100))
    : 0;
  const isCatalog = mode === 'catalog';

  const detailHref = href || `/books/${book._id}`;

  return (
    <Card className="group flex h-full min-w-0 flex-col overflow-hidden transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
      <Link href={detailHref} className="flex min-h-0 flex-1 flex-col text-inherit no-underline">
        <div
          className="flex aspect-[3/4] min-h-[230px] items-center justify-center overflow-hidden border-b border-border bg-surface-muted"
          style={getCoverPalette(book)}
        >
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" src={coverSrc} alt={book.title} />
          ) : (
            <div className="book-card-fallback">
              <span>{(book.genres || [])[0] || book.publicationStatus || 'Book'}</span>
              <strong>{book.title}</strong>
              <small>{authorName}</small>
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
              <span>{book.translatedUnitsTotal || book.translatedUnitsList?.length || '?'} units</span>
              <span className="truncate">{book.originalSource || 'Translated'}</span>
            </div>
          ) : (
            <div>
              <div className="mb-1 flex justify-between gap-2 text-xs text-copy">
                <span>Progress</span>
                <span>{book.unitsRead} / {book.translatedUnitsTotal || '?'} ch</span>
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
          {book.rawUnitsTotal > 0 ? `${book.rawUnitsTotal} raw indexed` : `Updated ${new Date(book.updatedAt).toLocaleDateString()}`}
        </span>
        {action}
      </CardFooter>
    </Card>
  );
}
