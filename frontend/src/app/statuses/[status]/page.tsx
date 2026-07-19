'use client';
import { cn } from '../../../lib/utils';

import { use, useEffect, useState } from 'react';
import { api, Book, BookStatus } from '../../../utils/api';
import { BookCard } from '../../../components/BookCard';
import { Spinner } from '../../../components/ui/spinner';

const statusLabels: Record<string, string> = {
  reading: 'Reading',
  completed: 'Completed',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  planning: 'Planning',
};

export default function StatusPage({ params }: { params: Promise<{ status: string }> }) {
  const { status } = use(params);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicCatalogBooks({ status: status as BookStatus })
      .then(setBooks)
      .catch((err) => console.error('Failed to load status books:', err))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5")}>
      <div className="flex items-end justify-between gap-4 py-1">
        <div>
          <h1 className="text-[clamp(1.55rem,3vw,2.2rem)] leading-tight mb-1">{statusLabels[status] || status}</h1>
          <p className="text-copy max-w-[720px]">Books with this reading status.</p>
        </div>
      </div>

      {loading ? (
        <Spinner size="md" />
      ) : books.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">
          No books found for this status.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,250px))] gap-3.5">
          {books.map((book) => <BookCard key={book._id} book={book} mode="catalog" />)}
        </div>
      )}
    </div>
  );
}
