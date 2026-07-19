import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRouter } from 'next/navigation';
import BooksPage from './page';
import type { Book, Genre, PublicationStatus, Author, Source } from '../../utils/api';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BooksPage', () => {
  const mockBook: Book = {
    _id: 'b1',
    title: 'Lord of the Mysteries',
    author: 'Cuttlefish',
    authorPenName: 'Cuttlefish',
    authorRealName: '',
    alternativeNames: [],
    genres: ['Fantasy'],
    genreKeys: ['fantasy'],
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
    chaptersRead: 10,
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

  function mockCatalogApis() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/public/catalog/books')) {
          return jsonResponse({
            books: [mockBook],
            total: 1,
            page: 1,
            pageSize: 24,
            totalPages: 1,
          });
        }
        if (url.includes('/public/genres')) return jsonResponse([{ _id: 'g1', name: 'Fantasy', key: 'fantasy', aliases: [], bookCount: 1, createdAt: '', updatedAt: '' }] as Genre[]);
        if (url.includes('/public/publication-statuses')) return jsonResponse([{ _id: 'p1', name: 'Ongoing', key: 'ongoing', aliases: [], color: '#000', sortOrder: 0, bookCount: 1, createdAt: '', updatedAt: '' }] as PublicationStatus[]);
        if (url.includes('/public/authors')) return jsonResponse([{ _id: 'a1', displayName: 'Cuttlefish', penName: '', realName: '', alternativeNames: [], nameKeys: [], originalLanguage: '', officialUrls: [], notes: '', createdAt: '', updatedAt: '' }] as Author[]);
        if (url.includes('/public/sources')) return jsonResponse([{ key: 'webnovel', name: 'Webnovel', count: 1 }] as Source[]);
        return { ok: false, status: 404, headers: { get: () => null }, json: async () => null, text: async () => '' };
      }),
    );
  }

  it('renders loading state then catalog books', async () => {
    mockCatalogApis();
    render(<BooksPage />);

    expect(document.querySelector('.spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Lord of the Mysteries' })).toBeInTheDocument();
    });

    expect(screen.getByText('Browse and filter the full catalog.')).toBeInTheDocument();
    expect(screen.getByText('100 chapters')).toBeInTheDocument();
  });

  it('updates the router when a filter changes', async () => {
    mockCatalogApis();
    const pushSpy = useRouter().push as ReturnType<typeof vi.fn>;

    render(<BooksPage />);

    await waitFor(() => expect(screen.getByPlaceholderText('Title, author, pen name...')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Title, author, pen name...');
    fireEvent.change(searchInput, { target: { value: 'mysteries' } });

    await waitFor(() => expect(pushSpy).toHaveBeenCalled());
    const pushedUrl = pushSpy.mock.calls[pushSpy.mock.calls.length - 1][0] as string;
    expect(pushedUrl).toContain('search=mysteries');
  });

  it('displays an error card when the catalog request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/public/catalog/books')) {
          return {
            ok: false,
            status: 500,
            headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
            json: async () => ({ error: 'Server down' }),
            text: async () => JSON.stringify({ error: 'Server down' }),
          };
        }
        if (url.includes('/public/genres')) return jsonResponse([]);
        if (url.includes('/public/publication-statuses')) return jsonResponse([]);
        if (url.includes('/public/authors')) return jsonResponse([]);
        if (url.includes('/public/sources')) return jsonResponse([]);
        return { ok: false, status: 404, headers: { get: () => null }, json: async () => null, text: async () => '' };
      }),
    );

    render(<BooksPage />);

    await waitFor(() => {
      expect(screen.getByText('Server down')).toBeInTheDocument();
    });
  });
});
