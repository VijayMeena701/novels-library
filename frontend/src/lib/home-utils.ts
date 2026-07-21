import { type Book } from '../utils/api';
import { type LucideIcon } from 'lucide-react';
import { BookOpen, BookText, Headphones, Library } from 'lucide-react';

export function byNewest(a: Book, b: Book) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function byChapterCount(a: Book, b: Book) {
  const aTotal = a.translatedChaptersTotal || a.translatedChaptersList?.length || 0;
  const bTotal = b.translatedChaptersTotal || b.translatedChaptersList?.length || 0;
  return bTotal - aTotal;
}

export function byRating(a: Book, b: Book) {
  return (b.rating || 0) - (a.rating || 0);
}

export function getAuthor(book: Book): string {
  return book.authorPenName || book.author || book.authorRealName || 'Unknown Author';
}

export function getChapterCount(book: Book): number {
  return book.translatedChaptersTotal || book.translatedChaptersList?.length || 0;
}

export function stableBookOrder(book: Book): number {
  return book._id.split('').reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
}

export const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: BookOpen,
    title: 'Track Progress',
    description: 'Keep tabs on every book you are reading, rereading, or planning to finish.',
  },
  {
    icon: BookText,
    title: 'Clean Reader',
    description: 'A distraction-free chapter reader with custom fonts and themes.',
  },
  {
    icon: Headphones,
    title: 'Text-to-Speech',
    description: 'Listen to chapters with built-in TTS, pronunciation rules, and skip lists.',
  },
  {
    icon: Library,
    title: 'Auto Archive',
    description: 'Background jobs scrape and archive chapters so they are available offline.',
  },
];
