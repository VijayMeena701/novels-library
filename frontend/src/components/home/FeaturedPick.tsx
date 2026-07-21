'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { type Book } from '../../utils/api';
import { getAuthor } from '../../lib/home-utils';

interface FeaturedPickProps {
  book: Book;
}

export function FeaturedPick({ book }: FeaturedPickProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl font-medium text-foreground">Featured Pick</h2>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid md:grid-cols-[180px_1fr]">
          <div className="relative min-h-[240px] bg-gradient-to-br from-surface to-surface-muted">
            <Link href={`/books/${book._id}`} className="absolute inset-0">
              <Image
                src={book.coverUrl || '/placeholder.svg'}
                alt={book.title}
                width={180}
                height={240}
                unoptimized
                className="h-full w-full object-cover"
              />
            </Link>
          </div>
          <div className="flex flex-col gap-3 p-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-copy">
              <Sparkles className="size-3.5" /> Featured Pick
            </span>
            <h3 className="font-serif text-2xl font-medium text-foreground">
              <Link href={`/books/${book._id}`}>{book.title}</Link>
            </h3>
            <p className="text-sm text-muted-copy">by {getAuthor(book)}</p>
            <p className="line-clamp-3 text-sm leading-relaxed text-copy">
              {book.description || 'No summary available yet.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {book.publicationStatus && <Badge variant="outline">{book.publicationStatus}</Badge>}
              {(book.genres || []).slice(0, 3).map((genre) => (
                <Badge key={genre} variant="outline">{genre}</Badge>
              ))}
            </div>
            <div className="mt-auto">
              <Button asChild variant="secondary">
                <Link href={`/books/${book._id}`}>View Book</Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
