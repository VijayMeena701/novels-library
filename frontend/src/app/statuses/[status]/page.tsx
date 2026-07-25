'use client';
import { cn } from '../../../lib/utils';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Book, BookStatus } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
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
  const { user, loading: authLoading } = useAuth();
  const { data: books = [], isLoading } = useQuery<Book[]>({
    queryKey: ['status-library', status],
    queryFn: () => api.getBooks({ status: status as BookStatus }),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  });

  const loading = authLoading || isLoading;

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5")}>
      <div className="flex items-end justify-between gap-4 py-1">
        <div>
          <h1 className="text-[clamp(1.55rem,3vw,2.2rem)] leading-tight mb-1">{statusLabels[status] || status}</h1>
          <p className="text-secondary max-w-[720px]">Books in your {statusLabels[status] || status} library.</p>
        </div>
      </div>

      {!user && !authLoading ? (
        <div className="rounded-lg border border-default bg-card shadow-elevation-2 transition hover:border-hover hover:bg-card-hover hover:shadow-elevation-4 p-12 text-center text-secondary">
          Sign in to view your library status lists.
        </div>
      ) : loading ? (
        <Spinner size="md" />
      ) : books.length === 0 ? (
        <div className="rounded-lg border border-default bg-card shadow-elevation-2 transition hover:border-hover hover:bg-card-hover hover:shadow-elevation-4 p-12 text-center text-secondary">
          No books in your {statusLabels[status] || status} list.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,250px))] gap-3.5">
          {books.map((book) => <BookCard key={book._id} book={book} />)}
        </div>
      )}
    </div>
  );
}
