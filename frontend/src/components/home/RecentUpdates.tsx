'use client';

import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { getAuthor, getChapterCount } from '../../lib/home-utils';
import { type Book } from '../../utils/api';

interface RecentUpdatesProps {
  books: Book[];
}

export function RecentUpdates({ books }: RecentUpdatesProps) {
  if (books.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl font-medium text-foreground">Recent Updates</h2>
      </div>
      <Card className="divide-y divide-border overflow-hidden">
        {books.map((book) => (
          <Link key={book._id} href={`/books/${book._id}`} className="group flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-muted">
            <div className="min-w-0">
              <strong className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</strong>
              <span className="text-xs text-muted-copy">{getAuthor(book)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-xs text-muted-copy">
              <span className="hidden sm:inline">{new Date(book.updatedAt).toLocaleDateString()}</span>
              <span>{getChapterCount(book)} chapters</span>
            </div>
          </Link>
        ))}
      </Card>
    </section>
  );
}
