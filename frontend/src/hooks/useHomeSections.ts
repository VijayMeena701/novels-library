'use client';

import { useMemo } from 'react';
import { type Book, type HomeResponse } from '../utils/api';
import { byNewest, byRating, byChapterCount, getChapterCount, stableBookOrder } from '../lib/home-utils';

export interface HomeSections {
  newest: Book[];
  ranked: Book[];
  longReads: Book[];
  completed: Book[];
  recent: Book[];
  random: Book[];
  genres: string[];
  totalChapters: number;
}

export interface UserLibrarySections {
  continueReading: Book[];
  planning: Book[];
  completed: Book[];
  topRated: Book[];
}

export interface UseHomeSectionsResult {
  sections: HomeSections;
  spotlightBook: Book | null;
  userSections: UserLibrarySections;
  showLongReads: boolean;
}

export function useHomeSections(books: Book[], libraryBooks: Book[], home: HomeResponse | null): UseHomeSectionsResult {
  const sections = useMemo<HomeSections>(() => {
    const newest = [...books].sort(byNewest);
    const ranked = [...books].sort(byRating);
    const longReads = [...books].sort(byChapterCount);
    const completed = books.filter((book) => {
      const publicationStatusKey = (book.publicationStatus || '').toLowerCase().replace(/\s+/g, '_');
      return publicationStatusKey === 'completed' || (book.publicationStatus || '').toLowerCase() === 'completed';
    });
    const recent = newest.slice(0, 12);
    const random = [...books].sort((a, b) => stableBookOrder(a) - stableBookOrder(b));
    const genres = Array.from(new Set(books.flatMap((book) => book.genres || []).filter(Boolean)));
    const totalChapters = books.reduce((sum, book) => sum + getChapterCount(book), 0);

    return {
      newest: newest.slice(0, 6),
      ranked: ranked.slice(0, 5),
      longReads: longReads.slice(0, 5),
      completed: completed.slice(0, 5),
      recent,
      random: random.slice(0, 5),
      genres: genres.slice(0, 12),
      totalChapters,
    };
  }, [books]);

  const spotlightBook = useMemo(() => {
    return sections.ranked[0] || sections.newest[0] || null;
  }, [sections.ranked, sections.newest]);

  const userSections = useMemo<UserLibrarySections>(() => {
    const byUpdated = [...libraryBooks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const byRating = [...libraryBooks].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const totalChaptersFor = (book: Book) => book.translatedChaptersTotal || book.translatedChaptersList?.length || 0;

    return {
      continueReading: home?.continueReading.length
        ? home.continueReading
        : byUpdated.filter((n) => n.status === 'reading' && n.chaptersRead > 0 && n.chaptersRead < totalChaptersFor(n)).slice(0, 6),
      planning: byUpdated.filter((n) => n.status === 'planning').slice(0, 6),
      completed: byUpdated.filter((n) => n.status === 'completed').slice(0, 6),
      topRated: byRating.filter((n) => (n.rating || 0) > 0).slice(0, 6),
    };
  }, [libraryBooks, home]);

  const showLongReads = books.length > 4;

  return { sections, spotlightBook, userSections, showLongReads };
}
