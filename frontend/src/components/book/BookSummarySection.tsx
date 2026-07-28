'use client';

import type { Book } from '../../utils/api';
import { Card } from '../ui/card';

interface BookSummarySectionProps {
  book: Book;
}

export function BookSummarySection({ book }: BookSummarySectionProps) {
  return (
    <Card className="p-[1.1rem] bg-surface border-default shadow-elevation-1 flex flex-col gap-3">
      <h2 className="text-base font-bold text-primary">Book Summary</h2>
      <p className="text-sm leading-relaxed whitespace-pre-line text-secondary">
        {book.description || 'No summary has been indexed for this book yet.'}
      </p>
    </Card>
  );
}
