'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { api, getBookCoverUrl, type Book, type BookVisit, type HistoryPagination } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';

function isBook(bookId: string | Book): bookId is Book {
  return typeof bookId === 'object' && bookId !== null && '_id' in bookId;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<BookVisit[]>([]);
  const [pagination, setPagination] = useState<HistoryPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    async function loadHistory() {
      try {
        const data = await api.getHistory(page, 50);
        if (!cancelled) {
          setVisits(data.visits);
          setPagination(data.pagination);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [user, page]);

  const books = useMemo(() => {
    const map = new Map<string, { book: Book; latestVisit: BookVisit }>();
    for (const visit of visits) {
      const book = isBook(visit.bookId) ? visit.bookId : null;
      if (!book) continue;
      const existing = map.get(book._id);
      if (!existing) {
        map.set(book._id, { book, latestVisit: visit });
      } else if (new Date(visit.openedAt).getTime() > new Date(existing.latestVisit.openedAt).getTime()) {
        existing.latestVisit = visit;
      }
    }

    const result = Array.from(map.values());
    result.sort(
      (a, b) => new Date(b.latestVisit.openedAt).getTime() - new Date(a.latestVisit.openedAt).getTime(),
    );
    return result;
  }, [visits]);

  if (!user) {
    return (
      <div className="container max-w-5xl mx-auto flex flex-1 items-center justify-center py-24">
        <Card className="mx-auto max-w-md p-8 text-center">
          <h1 className="font-serif text-2xl font-medium text-foreground">Reading History</h1>
          <p className="mt-2 text-sm text-muted-copy">Sign in to view your reading history.</p>
          <Button asChild className="mt-6">
            <Link href="/login">Sign In</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-medium text-foreground">Reading History</h1>
        <p className="text-sm text-muted-copy">
          {pagination ? `${books.length} books · ${pagination.total} visits` : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : books.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-copy">No reading history yet. Start reading a book!</p>
          <Button asChild className="mt-4">
            <Link href="/books">Browse Catalog</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {books.map(({ book, latestVisit }) => {
            const coverSrc = getBookCoverUrl(book);
            const authorName = book.authorPenName || book.author || book.authorRealName || 'Unknown Author';

            return (
              <Link key={book._id} href={`/history/${book._id}`} className="group block">
                <Card className="flex items-center gap-4 p-4 transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
                  {coverSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverSrc}
                      alt={book.title}
                      className="h-24 w-16 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-16 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-surface-muted p-2 text-center text-xs">
                      <span className="line-clamp-2 font-bold text-foreground">{book.title}</span>
                    </div>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2 className="font-serif text-lg font-bold text-foreground group-hover:underline">
                      {book.title}
                    </h2>
                    <p className="text-sm text-muted-copy">{authorName}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-copy">
                      <Clock className="size-3.5" />
                      <span>
                        Latest: Unit {latestVisit.unitNumber}
                        {latestVisit.unitTitle ? ` - ${latestVisit.unitTitle}` : ''} · {formatDate(latestVisit.openedAt)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="size-5 shrink-0 text-muted-copy transition group-hover:translate-x-1 group-hover:text-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-copy">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
