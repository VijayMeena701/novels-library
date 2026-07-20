'use client';
import { cn } from '../../../lib/utils';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api, Author, Book } from '../../../utils/api';
import { BookCard } from '../../../components/BookCard';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';

export default function AuthorDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [author, setAuthor] = useState<Author | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicAuthor(id)
      .then((data) => {
        setAuthor(data.author);
        setBooks(data.books);
      })
      .catch((err) => console.error('Failed to load author:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12")}><Spinner size="md" /></div>;
  }

  if (!author) {
    return (
      <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12")}>
        <h1>Author Not Found</h1>
        <Button asChild variant="secondary" className="mt-4">
          <Link href="/authors">Back to Authors</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5")}>
      <div className="flex flex-col gap-[0.8rem] rounded-lg border border-border bg-card p-6 shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
        <Link href="/authors" className="rounded-md px-3 py-2 text-[0.86rem] font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground">Back to Authors</Link>
        <h1 className="text-[clamp(1.55rem,3vw,2.2rem)] leading-tight mb-1">{author.displayName}</h1>
        {author.realName && <p className="text-copy">Real name: {author.realName}</p>}
        {author.originalLanguage && <p className="text-copy">Original language: {author.originalLanguage}</p>}
        {author.alternativeNames.length > 0 && (
          <p className="text-muted-copy">Also known as: {author.alternativeNames.join(', ')}</p>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-[1.35rem]">Books by {author.displayName}</h2>
        {books.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">No linked books yet.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,250px))] gap-3.5">
            {books.map((book) => <BookCard key={book._id} book={book} mode="catalog" />)}
          </div>
        )}
      </section>
    </div>
  );
}
