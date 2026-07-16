import mongoose from 'mongoose';
import { Book } from '@/models/Novel.js';
import { ChapterContent } from '@/models/ChapterContent.js';

export async function createSampleBook(overrides: Record<string, unknown> = {}) {
  return Book.create({
    title: 'Test Book',
    author: 'Test Author',
    ...overrides,
  });
}

export async function createSampleChapter(
  bookId: string | mongoose.Types.ObjectId,
  chapterNumber: number,
  title = `Chapter ${chapterNumber}`,
  content = 'Test chapter content.',
) {
  return ChapterContent.create({
    bookId: new mongoose.Types.ObjectId(bookId),
    chapterNumber,
    title,
    content,
  });
}
