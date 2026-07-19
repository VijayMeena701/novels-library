'use client';
import { cn } from '../../../lib/utils';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ChevronLeft, Clock, Library, Pencil } from 'lucide-react';
import { api, getBookCoverUrl, type Book, type ChapterVisit } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';

function getStatusBadgeVariant(status?: string) {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');

  if (normalized === 'completed') return 'completed';
  if (normalized === 'reading') return 'reading';
  if (normalized === 'on_hold' || normalized === 'pending') return 'hold';
  if (normalized === 'dropped' || normalized === 'failed') return 'dropped';
  if (normalized === 'planning') return 'planning';
  if (normalized === 'processing') return 'processing';

  return 'default';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type HistoryEvent =
  | { type: 'library_add'; date: string; label: string; icon: typeof Library }
  | { type: 'library_update'; date: string; label: string; icon: typeof Pencil }
  | { type: 'visit'; date: string; label: string; icon: typeof BookOpen; visit: ChapterVisit };

export default function BookHistoryPage() {
  const { user } = useAuth();
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId || '';

  const [book, setBook] = useState<Book | null>(null);
  const [visits, setVisits] = useState<ChapterVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !bookId) return;
    let cancelled = false;

    async function loadBookHistory() {
      setLoading(true);
      setError(null);
      try {
        const [bookData, visitsData] = await Promise.all([
          api.getBook(bookId),
          api.getChapterVisits(bookId, 200),
        ]);
        if (!cancelled) {
          setBook(bookData);
          setVisits(visitsData);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load book history.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBookHistory();
    return () => {
      cancelled = true;
    };
  }, [user, bookId]);

  const events = useMemo<HistoryEvent[]>(() => {
    const list: HistoryEvent[] = [];

    if (book?.userBookCreatedAt) {
      list.push({
        type: 'library_add',
        date: book.userBookCreatedAt,
        label: 'Added to library',
        icon: Library,
      });
    }

    if (book?.userBookUpdatedAt && book.userBookUpdatedAt !== book.userBookCreatedAt) {
      list.push({
        type: 'library_update',
        date: book.userBookUpdatedAt,
        label: 'Updated library entry',
        icon: Pencil,
      });
    }

    for (const visit of visits) {
      list.push({
        type: 'visit',
        date: visit.openedAt,
        label: visit.chapterTitle
          ? `Read Chapter ${visit.chapterNumber}: ${visit.chapterTitle}`
          : `Read Chapter ${visit.chapterNumber}`,
        icon: BookOpen,
        visit,
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [book, visits]);

  if (!user) {
    return (
      <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "max-w-5xl mx-auto flex flex-1 items-center justify-center py-24")}>
        <Card className="mx-auto max-w-md p-8 text-center">
          <h1 className="font-serif text-2xl font-medium text-foreground">Book History</h1>
          <p className="mt-2 text-sm text-muted-copy">Sign in to view your reading history.</p>
          <Button asChild className="mt-6">
            <Link href="/login">Sign In</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "max-w-5xl mx-auto py-8")}>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1">
        <Link href="/history">
          <ChevronLeft className="size-4" />
          Back to history
        </Link>
      </Button>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-muted-copy">{error}</p>
          <Button asChild className="mt-4">
            <Link href="/history">Back to history</Link>
          </Button>
        </Card>
      ) : !book ? null : (
        <>
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex gap-4">
                <Link href={`/books/${book._id}`}>
                  {getBookCoverUrl(book) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getBookCoverUrl(book)}
                      alt={book.title}
                      className="h-32 w-24 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-24 flex-col items-center justify-center rounded-md border border-border bg-surface-muted p-2 text-center text-xs">
                      <span className="line-clamp-2 font-bold text-foreground">{book.title}</span>
                    </div>
                  )}
                </Link>
                <div className="flex flex-col justify-center gap-1">
                  <Link href={`/books/${book._id}`} className="font-serif text-2xl font-bold text-foreground hover:underline">
                    {book.title}
                  </Link>
                  <p className="text-sm text-muted-copy">
                    {book.authorPenName || book.author || book.authorRealName || 'Unknown Author'}
                  </p>
                  <Badge variant={getStatusBadgeVariant(book.status)}>
                    {(book.status || 'planning').replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>

              {book.lastVisitedChapterNumber ? (
                <Button asChild className="sm:ml-auto">
                  <Link href={`/books/${book._id}/reader/${book.lastVisitedChapterNumber}`}>
                    Continue reading
                  </Link>
                </Button>
              ) : null}
            </div>
          </Card>

          <div className="mt-6">
            <h2 className="mb-4 font-serif text-xl font-medium text-foreground">Activity</h2>
            <div className="grid gap-3">
              {events.map((event, index) => {
                const Icon = event.icon;
                const content = (
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                      <Icon className="size-5 text-muted-copy" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium text-foreground">{event.label}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-copy">
                        <Clock className="size-3.5" />
                        {formatDate(event.date)}
                      </span>
                    </div>
                  </div>
                );

                if (event.type === 'visit' && event.visit) {
                  return (
                    <Link
                      key={index}
                      href={`/books/${book._id}/reader/${event.visit.chapterNumber}`}
                      className="block"
                    >
                      <Card className="transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
                        {content}
                      </Card>
                    </Link>
                  );
                }

                return (
                  <Card key={index}>
                    {content}
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
