'use client';
import { cn } from '../../lib/utils';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, Author } from '../../utils/api';
import { Spinner } from '../../components/ui/spinner';

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicAuthors()
      .then(setAuthors)
      .catch((err) => console.error('Failed to load authors:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5")}>
      <div className="flex items-end justify-between gap-4 py-1">
        <div>
          <h1 className="text-[clamp(1.55rem,3vw,2.2rem)] leading-tight mb-1">Authors</h1>
          <p className="text-copy max-w-[720px]">Browse books by pen name, real name, and aliases.</p>
        </div>
      </div>

      {loading ? (
        <Spinner size="md" />
      ) : authors.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">
          No authors have been linked yet. Scrape metadata or edit a book author to create author records.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,250px))] gap-3.5">
          {authors.map((author) => (
            <Link key={author._id} href={`/authors/${author._id}`} style={{ textDecoration: 'none' }}>
              <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated" style={{ padding: '1.25rem', minHeight: '150px', height: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>{author.displayName}</h3>
                {author.realName && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real name: {author.realName}</p>}
                {author.alternativeNames.length > 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{author.alternativeNames.slice(0, 3).join(', ')}</p>
                )}
                <span style={{ marginTop: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {author.bookCount || 0} linked book{author.bookCount === 1 ? '' : 's'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
