import Link from 'next/link';
import { BookOpen, Star } from 'lucide-react';
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
    <Card className="books-card group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-card transition duration-200 ease-out hover:-translate-y-1 hover:bg-card-hover">
      <Link href={detailHref} className="flex min-h-0 flex-1 flex-col text-inherit no-underline">
        <div className="books-cover relative flex aspect-[3/4] min-h-[230px] items-center justify-center overflow-hidden bg-surface-muted">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.03]" src={coverSrc} alt={book.title} />
          ) : (
            <div
              className="relative flex h-full w-full flex-col justify-end gap-[0.45rem] p-4 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.28)] before:pointer-events-none before:absolute before:left-[0.65rem] before:top-[0.7rem] before:bottom-[0.7rem] before:w-[3px] before:rounded-full before:bg-white/35"
              style={getCoverStyle(book)}
            >
              <strong className="line-clamp-3 text-[1.08rem] font-black leading-[1.18] text-white">
                {book.title}
              </strong>
              <small className="block truncate text-[0.76rem] text-white/[0.78]">
                {authorName}
              </small>
            </div>
          )}
        {isCatalog && (book.publicationStatus || (book.genres || []).length > 0) && (
          <div className="books-cover-overlay pointer-events-none absolute inset-x-0 bottom-0 z-10 flex translate-y-1 flex-wrap items-end gap-1.5 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-12 opacity-0 transition duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            {book.publicationStatus && <Badge className="bg-white/90 text-black">{book.publicationStatus}</Badge>}
            {(book.genres || []).slice(0, 2).map((genre) => (
              <Badge key={genre} className="bg-white/90 text-black">{genre}</Badge>
            ))}
          </div>
        )}

        {isCatalog && (book.publicationStatus || typeof book.ratingAverage === 'number') && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2">
            {book.publicationStatus && (
              <span className="inline-flex items-center rounded bg-black/60 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white">
                {book.publicationStatus}
              </span>
            )}
            {typeof book.ratingAverage === 'number' && (
              <span className="inline-flex items-center gap-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
                <Star className="size-3 fill-current" />
                {book.ratingAverage > 0 ? (Number.isInteger(book.ratingAverage) ? book.ratingAverage : book.ratingAverage.toFixed(1)) : '–'}
              </span>
            )}
          </div>
        )}
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 py-3.5">
          <div>
            <h3 className="line-clamp-2 break-words text-base font-bold leading-snug tracking-tight text-foreground">{book.title}</h3>
            <p className="mt-1 truncate text-[0.8125rem] text-copy">{authorName}</p>
          </div>

          {!isCatalog && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={getStatusBadgeVariant(book.status)}>{book.status.replace('_', ' ')}</Badge>
              {book.publicationStatus && <Badge>{book.publicationStatus}</Badge>}
              {(book.genres || []).slice(0, 2).map((genre) => (
                <Badge key={genre}>{genre}</Badge>
              ))}
            </div>
          )}

          {isCatalog ? (
            <div className="mt-auto flex items-center justify-between gap-2 text-[0.75rem]">
              <span className="inline-flex items-center gap-1 font-medium text-copy">
                <BookOpen className="size-3.5 text-muted-copy" />
                {book.translatedChaptersTotal || book.translatedChaptersList?.length || '?'}
              </span>
              <span className="truncate text-muted-copy">{book.originalSource || 'Translated'}</span>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 flex justify-between gap-2 text-[0.8125rem] text-muted-copy">
                <span className="font-medium text-copy">Progress</span>
                <span>{book.chaptersRead} / {book.translatedChaptersTotal || '?'} ch</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

        </div>
      </Link>

      {!isCatalog && (
        <CardFooter className="mt-auto border-t-0 px-4 py-2.5 text-[0.6875rem] text-muted-copy">
          <span className="truncate">
            {book.rawChaptersTotal > 0 ? `${book.rawChaptersTotal} raw indexed` : `Updated ${new Date(book.updatedAt).toLocaleDateString()}`}
          </span>
          {action}
        </CardFooter>
      )}
    </Card>
  );
}
