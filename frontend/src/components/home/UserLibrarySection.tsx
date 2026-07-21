'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { BookCard } from '../../components/BookCard';
import { type Book } from '../../utils/api';

interface UserLibrarySectionProps {
  continueReading: Book[];
  planning: Book[];
  completed: Book[];
  topRated: Book[];
  libraryEmpty: boolean;
}

function BookCardGrid({ books }: { books: Book[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {books.map((book) => (
        <BookCard key={book._id} book={book} mode="profile" href={`/books/${book._id}`} />
      ))}
    </div>
  );
}

function SubSection({ title, books }: { title: string; books: Book[] }) {
  if (books.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">{title}</h3>
      <BookCardGrid books={books} />
    </div>
  );
}

export function UserLibrarySection({
  continueReading,
  planning,
  completed,
  topRated,
  libraryEmpty,
}: UserLibrarySectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl font-medium text-foreground">Your Library</h2>
        <div className="flex items-center gap-4">
          <Link href="/history" className="text-sm font-semibold text-primary hover:underline">
            History
          </Link>
          <Link href="/profile" className="text-sm font-semibold text-primary hover:underline">
            Open Library <ArrowRight className="inline size-4" />
          </Link>
        </div>
      </div>
      <Card className="p-5">
        <div className="flex flex-col gap-6">
          <SubSection title="Continue Reading" books={continueReading} />
          <SubSection title="Plan to Read" books={planning} />
          <SubSection title="Completed" books={completed} />
          <SubSection title="Top Rated" books={topRated} />
          {libraryEmpty && (
            <p className="text-sm text-muted-copy">Your library is empty. Browse the catalog to add books.</p>
          )}
        </div>
      </Card>
    </section>
  );
}
