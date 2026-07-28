'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { getAuthor } from '../../lib/home-utils';
import { type Book } from '../../utils/api';

interface HomeSidebarProps {
  ranked: Book[];
  genres: string[];
  completed: Book[];
  random: Book[];
}

function TrendingWidget({ books }: { books: Book[] }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="p-3 sm:p-4">
        <CardTitle className="inline-flex items-center gap-2 font-serif text-base font-bold">
          <TrendingUp className="size-4 text-accent" /> Trending
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 px-3 pb-3 sm:px-4 sm:pb-4">
        {books.map((book, index) => {
          const rank = index + 1;
          const rankClass =
            rank === 1
              ? 'bg-accent text-on-accent'
              : rank === 2
                ? 'bg-accent-subtle text-accent'
                : rank === 3
                  ? 'bg-surface-raised text-primary'
                  : 'bg-surface text-muted';
          return (
            <Link
              key={book._id}
              href={`/books/${book._id}`}
              className="group flex items-center gap-3 border-b border-default py-2.5 transition last:border-b-0 hover:pl-1"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${rankClass}`}
              >
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-semibold text-primary group-hover:text-primary">
                  {book.title}
                </strong>
                <small className="block truncate text-xs text-muted">{getAuthor(book)}</small>
              </div>
              <small className="shrink-0 text-xs font-semibold text-muted">{(book.rating || 0).toFixed(1)}</small>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function GenresWidget({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <Card className="rounded-2xl">
      <CardHeader className="p-3 sm:p-4">
        <CardTitle className="font-serif text-base font-medium">Genres</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
        {genres.map((genre) => (
          <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`}>
            <Badge variant="default" className="transition hover:bg-accent-subtle hover:text-accent">
              {genre}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function MiniBookList({ title, books }: { title: string; books: Book[] }) {
  if (books.length === 0) return null;
  return (
    <Card className="rounded-2xl">
      <CardHeader className="p-3 sm:p-4">
        <CardTitle className="font-serif text-base font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 px-3 pb-3 sm:px-4 sm:pb-4">
        {books.map((book) => (
          <Link
            key={book._id}
            href={`/books/${book._id}`}
            className="group flex flex-col gap-0.5 rounded-lg border-b border-default px-2 py-2.5 transition last:border-b-0 hover:bg-surface-raised hover:pl-3"
          >
            <strong className="truncate text-sm font-semibold text-accent group-hover:text-accent">{book.title}</strong>
            <small className="block truncate text-xs text-muted">{getAuthor(book)}</small>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function HomeSidebar({ ranked, genres, completed, random }: HomeSidebarProps) {
  return (
    <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-24">
      <TrendingWidget books={ranked} />
      <GenresWidget genres={genres} />
      <MiniBookList title="Completed" books={completed} />
      <MiniBookList title="Random" books={random} />
    </aside>
  );
}
