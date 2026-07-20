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
            <Link key={author._id} href={`/authors/${author._id}`} className="no-underline">
              <div className="flex h-full min-h-[150px] flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
                <h3 className="text-[1.1rem]">{author.displayName}</h3>
                {author.realName && <p className="text-[0.9rem] text-copy">Real name: {author.realName}</p>}
                {author.alternativeNames.length > 0 && (
                  <p className="text-[0.82rem] text-muted-copy">{author.alternativeNames.slice(0, 3).join(', ')}</p>
                )}
                <span className="mt-auto text-[0.85rem] text-copy">
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
