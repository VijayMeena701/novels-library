import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BookCard } from '@/components/BookCard';
import type { Book } from '@/utils/api';

const book: Book = {
  _id: 'b1',
  title: 'Lord of the Mysteries',
  author: 'Cuttlefish',
  authorPenName: 'Cuttlefish That Loves Diving',
  authorRealName: '',
  alternativeNames: ['LotM'],
  genres: ['Fantasy', 'Mystery'],
  genreKeys: ['fantasy', 'mystery'],
  originalSource: 'Webnovel',
  originalSourceKey: 'webnovel',
  publicationStatus: 'Ongoing',
  publicationStatusKey: 'ongoing',
  description: '',
  coverUrl: '',
  coverImagePath: '',
  coverImageMimeType: '',
  coverImageSize: 0,
  coverImageToken: '',
  sourceUrl: '',
  rawSourceUrl: '',
  rawOriginalLanguage: '',
  rawChaptersTotal: 0,
  rawChaptersList: [],
  status: 'reading',
  translatedChaptersTotal: 100,
  chaptersRead: 25,
  rating: 0,
  review: '',
  personalNotes: '',
  rawLegacyEntry: '',
  characterNotes: '',
  relationshipNotes: '',
  personalTags: [],
  personalTagKeys: [],
  translatedChaptersList: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-07-17T10:00:00.000Z',
};

describe('BookCard', () => {
  it('renders title, author, and link', () => {
    render(<BookCard book={book} />);
    expect(screen.getByRole('heading', { name: book.title })).toBeInTheDocument();
    expect(screen.getByText(book.authorPenName, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', `/books/${book._id}`);
  });

  it('shows profile progress and chapters read', () => {
    render(<BookCard book={book} mode="profile" />);
    expect(screen.getByText('25 / 100 ch')).toBeInTheDocument();
  });

  it('renders catalog metadata and chapter count', () => {
    render(<BookCard book={book} mode="catalog" />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('Ongoing')).toHaveLength(2);
  });

  it('renders custom action slot', () => {
    render(<BookCard book={book} action={<button data-testid="action">+1</button>} />);
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('renders fallback when no cover is available', () => {
    render(<BookCard book={{ ...book, coverUrl: '', coverImageToken: '', coverImageSyncedAt: null }} />);
    expect(screen.getByText(book.title, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(book.authorPenName, { selector: 'small' })).toBeInTheDocument();
  });
});
