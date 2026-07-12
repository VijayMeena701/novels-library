'use client';

import { use, useEffect, useState } from 'react';
import { api, Book, BookStatus } from '../../../utils/api';
import { BookCard } from '../../../components/BookCard';

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
    <div className="container page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{statusLabels[status] || status}</h1>
          <p className="page-subtitle">Books with this reading status.</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : books.length === 0 ? (
        <div className="glass-card empty-state">
          No books found for this status.
        </div>
      ) : (
        <div className="book-grid">
          {books.map((book) => <BookCard key={book._id} book={book} mode="catalog" />)}
        </div>
      )}
    </div>
  );
}
