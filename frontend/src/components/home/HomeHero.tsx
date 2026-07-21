'use client';

import Link from 'next/link';
import { type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { getLoginHref } from '../../lib/utils';
import { type User } from '../../utils/api';

interface HomeHeroProps {
  user: User | null;
  pathname: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: FormEvent) => void;
  totalBooks: number;
  totalChapters: number;
  completedCount: number;
}

export function HomeHero({
  user,
  pathname,
  search,
  onSearchChange,
  onSearchSubmit,
  totalBooks,
  totalChapters,
  completedCount,
}: HomeHeroProps) {
  return (
    <Card className="relative overflow-hidden p-6 lg:p-8">
      <div className="relative z-10 flex max-w-3xl flex-col gap-5 text-center sm:text-left">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-copy">Personal Web Book Library</span>
        <h1 className="font-serif text-3xl font-medium leading-tight text-foreground lg:text-4xl">
          Read, track, and archive web books in one place.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-copy">
          Discover translated and raw web books, keep your reading progress, and let the background crawler archive chapters automatically.
        </p>
        <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={onSearchSubmit}>
          <Input
            type="text"
            placeholder="Search books, authors, or genres..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <Button type="submit" className="shrink-0 gap-2">
            <Search className="size-4" />
            <span>Search</span>
          </Button>
        </form>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/books">Browse Catalog</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={user ? '/profile' : getLoginHref(pathname)}>{user ? 'Open Library' : 'Login to Track'}</Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
            <strong className="block text-lg font-semibold leading-none text-foreground">{totalBooks}</strong>
            <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-muted-copy">Books</span>
          </div>
          <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
            <strong className="block text-lg font-semibold leading-none text-foreground">{totalChapters}</strong>
            <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-muted-copy">Chapters</span>
          </div>
          <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
            <strong className="block text-lg font-semibold leading-none text-foreground">{completedCount}</strong>
            <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-muted-copy">Completed</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
