'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BookCard } from '../../components/BookCard';
import { type Book } from '../../utils/api';

interface BookSectionProps {
  title: string;
  books: Book[];
  viewAllHref?: string;
}

export function BookSection({ title, books, viewAllHref }: BookSectionProps) {
  if (books.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl font-medium text-foreground">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-semibold text-primary hover:underline">
            View all <ArrowRight className="inline size-4" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {books.map((book) => (
          <BookCard key={book._id} book={book} mode="catalog" />
        ))}
      </div>
    </section>
  );
}
