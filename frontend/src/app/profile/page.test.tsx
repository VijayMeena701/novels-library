import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ProfilePage from './page';
import { AuthProvider } from '../../context/AuthContext';
import { api } from '../../utils/api';
import type { Book, User } from '../../utils/api';

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
  api.logout();
});

const mockUser: User = {
  id: 'u1',
  username: 'Reader',
  email: 'reader@example.com',
  capabilities: ['books:read', 'books:create', 'library:read'],
};

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
  translatedChaptersTotal: 10,
  chaptersRead: 0,
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

function setupMocks(book: Book = mockBook) {
  const payload = btoa(JSON.stringify({ id: mockUser.id, email: mockUser.email }));
  api.setToken(`profile.${payload}.sig`);

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/auth/me')) {
        return jsonResponse({ user: mockUser });
      }
      if (url.includes('/api/books') && !url.includes('/api/books/') && init?.method !== 'POST') {
        return jsonResponse([book]);
      }
      if (url.includes('/api/books/') && init?.method === 'PUT') {
        return jsonResponse({ ...book, chaptersRead: book.chaptersRead + 1 });
      }
      return { ok: false, status: 404, headers: { get: () => null }, json: async () => null, text: async () => '' };
    }),
  );
}

describe('ProfilePage', () => {
  it('renders loading then library stats and book card', async () => {
    setupMocks();
    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Personal Library')).toBeInTheDocument();
    });

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lord of the Mysteries' })).toBeInTheDocument();
  });

  it('increments chapters read when +1 is clicked', async () => {
    setupMocks();
    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('0 / 10 ch')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '+1' }));

    await waitFor(() => expect(screen.getByText('1 / 10 ch')).toBeInTheDocument());
  });

  it('opens create book modal and validates URLs', async () => {
    setupMocks();
    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('Personal Library')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Create Catalog Book/i }));

    const sourceInput = screen.getByPlaceholderText('https://example.com/book/title');
    await userEvent.type(sourceInput, 'not-a-url');

    await userEvent.click(screen.getByRole('button', { name: 'Create Catalog Book' }));
    await waitFor(() => {
      expect(screen.getByText(/valid HTTP\/HTTPS URL/i)).toBeInTheDocument();
    });
  });
});
