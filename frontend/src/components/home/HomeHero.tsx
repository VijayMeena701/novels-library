'use client';

import Link from 'next/link';
import { type FormEvent } from 'react';
import { Search, Library } from 'lucide-react';
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
    <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary/10 to-surface p-5 shadow-elevation-4 sm:p-6 lg:p-8">
      <div className="relative z-10 flex max-w-3xl flex-col gap-5 text-center sm:text-left">
        <span className="inline-flex w-fit items-center gap-1.5 self-center rounded-full bg-accent-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent sm:self-start">
          <Library className="size-3.5" /> Personal Web Book Library
        </span>
        <h1 className="text-balance break-words font-serif text-[clamp(1.75rem,5vw,3rem)] font-bold leading-tight text-primary">
          Read, track, and archive web books in one place.
        </h1>
        <p className="max-w-xl break-words text-base leading-relaxed text-secondary">
          Discover translated and raw web books, keep your reading progress, and let the background crawler archive chapters automatically.
        </p>
        <form className="relative mx-auto flex w-full max-w-xl flex-col gap-2 sm:mx-0 sm:flex-row" onSubmit={onSearchSubmit}>
          <Input
            type="text"
            placeholder="Search books, authors, or genres..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-12 bg-app/60 pr-12 sm:pr-4"
          />
          <Button
            type="submit"
            className="absolute right-1.5 top-1/2 h-10 -translate-y-1/2 gap-2 px-3 sm:static sm:h-12 sm:translate-y-0 sm:px-4"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
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
        <div className="flex flex-wrap justify-center gap-3 pt-2 sm:justify-start">
          {[
            { label: 'Books', value: totalBooks },
            { label: 'Chapters', value: totalChapters },
            { label: 'Completed', value: completedCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex min-w-[90px] flex-none flex-col items-center rounded-2xl border border-default/60 bg-app/60 px-3 py-3 backdrop-blur-sm sm:min-w-[100px] sm:px-4"
            >
              <strong className="text-2xl font-bold leading-none text-primary">{stat.value}</strong>
              <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
