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
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 font-serif text-base font-medium">
          <TrendingUp className="size-4" /> Trending
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {books.map((book, index) => (
          <Link key={book._id} href={`/books/${book._id}`} className="group flex items-center gap-3 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-xs font-bold text-muted-copy">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</strong>
              <small className="text-xs text-muted-copy">{getAuthor(book)}</small>
            </div>
            <small className="text-xs font-semibold text-muted-copy">{(book.rating || 0).toFixed(1)}</small>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function GenresWidget({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base font-medium">Genres</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`}>
            <Badge variant="outline">{genre}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function MiniBookList({ title, books }: { title: string; books: Book[] }) {
  if (books.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {books.map((book) => (
          <Link key={book._id} href={`/books/${book._id}`} className="group flex flex-col gap-0.5 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
            <strong className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</strong>
            <small className="text-xs text-muted-copy">{getAuthor(book)}</small>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function HomeSidebar({ ranked, genres, completed, random }: HomeSidebarProps) {
  return (
    <aside className="sticky top-24 flex flex-col gap-4 self-start">
      <TrendingWidget books={ranked} />
      <GenresWidget genres={genres} />
      <MiniBookList title="Completed" books={completed} />
      <MiniBookList title="Random" books={random} />
    </aside>
  );
}
