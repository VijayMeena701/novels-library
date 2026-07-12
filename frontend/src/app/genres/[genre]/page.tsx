'use client';

import { use, useEffect, useState } from 'react';
import { api, Book } from '../../../utils/api';
import { BookCard } from '../../../components/BookCard';

export default function GenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre: rawGenre } = use(params);
  const genre = decodeURIComponent(rawGenre);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicCatalogBooks({ genre })
      .then(setBooks)
      .catch((err) => console.error('Failed to load genre books:', err))
      .finally(() => setLoading(false));
  }, [genre]);

  return (
    <div className="container page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{genre}</h1>
          <p className="page-subtitle">Books tagged with this genre.</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : books.length === 0 ? (
        <div className="glass-card empty-state">
          No books found for this genre.
        </div>
      ) : (
        <div className="book-grid">
          {books.map((book) => <BookCard key={book._id} book={book} mode="catalog" />)}
        </div>
      )}
    </div>
  );
}
