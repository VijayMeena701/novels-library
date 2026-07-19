import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BooksFilterPanel } from '@/components/BooksFilterPanel';
import type { CatalogBookFilters, Genre, PublicationStatus, Source, Author, BookStatus } from '@/utils/api';

const filters: CatalogBookFilters = {
  search: '',
  status: 'all',
  sort: 'updatedAt',
  sortDir: 'desc',
};

const genres: Genre[] = [
  { _id: 'g1', name: 'Fantasy', key: 'fantasy', aliases: [], bookCount: 12, createdAt: '', updatedAt: '' },
  { _id: 'g2', name: 'Sci-Fi', key: 'sci-fi', aliases: [], bookCount: 5, createdAt: '', updatedAt: '' },
];

const publicationStatuses: PublicationStatus[] = [
  { _id: 'p1', name: 'Ongoing', key: 'ongoing', aliases: [], color: '#000', sortOrder: 0, bookCount: 8, createdAt: '', updatedAt: '' },
];

const sources: Source[] = [{ key: 'webnovel', name: 'Webnovel', count: 20 }];

const authors: Author[] = [{ _id: 'a1', displayName: 'Cuttlefish', penName: '', realName: '', alternativeNames: [], nameKeys: [], originalLanguage: '', officialUrls: [], notes: '', bookCount: 3, createdAt: '', updatedAt: '' }];

const readingStatuses: { value: BookStatus; label: string }[] = [
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' },
];

describe('BooksFilterPanel', () => {
  it('renders search input and clear filters button', () => {
    render(
      <BooksFilterPanel
        filters={filters}
        options={{ genres, publicationStatuses, sources, authors, readingStatuses }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Title, author, pen name...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
  });

  it('calls onChange when search input changes', async () => {
    const onChange = vi.fn();
    render(
      <BooksFilterPanel
        filters={filters}
        options={{ genres, publicationStatuses, sources, authors, readingStatuses }}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText('Title, author, pen name...');
    await userEvent.type(input, 'mysteries');
    expect(onChange).toHaveBeenLastCalledWith({ search: 'mysteries' });
  });

  it('toggles genre filters', async () => {
    const onChange = vi.fn();
    render(
      <BooksFilterPanel
        filters={filters}
        options={{ genres, publicationStatuses, sources, authors, readingStatuses }}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Fantasy/));
    expect(onChange).toHaveBeenLastCalledWith({ genre: 'fantasy' });
  });

  it('toggles a publication status off when already selected', async () => {
    const onChange = vi.fn();
    render(
      <BooksFilterPanel
        filters={{ ...filters, publicationStatus: 'ongoing' }}
        options={{ genres, publicationStatuses, sources, authors, readingStatuses }}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Ongoing/));
    expect(onChange).toHaveBeenLastCalledWith({ publicationStatus: undefined });
  });

  it('calls onClear when clear button is clicked', async () => {
    const onClear = vi.fn();
    render(
      <BooksFilterPanel
        filters={{ ...filters, search: 'x' }}
        options={{ genres, publicationStatuses, sources, authors, readingStatuses }}
        onChange={vi.fn()}
        onClear={onClear}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Clear filters/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows active filter count badge', () => {
    const { container } = render(
      <BooksFilterPanel
        filters={{ ...filters, search: 'x', genre: 'fantasy,sci-fi', minRating: 4, status: 'reading' }}
        options={{ genres, publicationStatuses, sources, authors, readingStatuses }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const header = container.querySelector('[class*="CardHeader"]') || screen.getByText('Filters').closest('div');
    expect(header?.textContent).toContain('5');
  });
});
