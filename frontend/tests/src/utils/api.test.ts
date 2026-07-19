import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, getBookCoverUrl, API_BASE_URL } from '@/utils/api';
import type { Book } from '@/utils/api';

describe('ApiError', () => {
  it('stores status, code, and details', () => {
    const error = new ApiError('Not found', 404, 'NOT_FOUND', { id: 'x' });
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details).toEqual({ id: 'x' });
  });
});

describe('getBookCoverUrl', () => {
  it('returns cached cover URL when token and syncedAt are present', () => {
    const book: Pick<Book, '_id' | 'coverUrl' | 'coverImageToken' | 'coverImageSyncedAt'> = {
      _id: 'b1',
      coverUrl: 'http://fallback.jpg',
      coverImageToken: 'tok',
      coverImageSyncedAt: '2026-07-17T10:00:00.000Z',
    };
    expect(getBookCoverUrl(book)).toContain(`/public/books/b1/cover/tok`);
    expect(getBookCoverUrl(book)).toContain(encodeURIComponent(book.coverImageSyncedAt!));
  });

  it('falls back to coverUrl when no synced token', () => {
    const book: Pick<Book, '_id' | 'coverUrl' | 'coverImageToken' | 'coverImageSyncedAt'> = {
      _id: 'b1',
      coverUrl: 'http://fallback.jpg',
      coverImageToken: '',
      coverImageSyncedAt: null,
    };
    expect(getBookCoverUrl(book)).toBe('http://fallback.jpg');
  });

  it('returns empty string when no cover is available', () => {
    const book: Pick<Book, '_id' | 'coverUrl' | 'coverImageToken' | 'coverImageSyncedAt'> = {
      _id: 'b1',
      coverUrl: '',
      coverImageToken: '',
      coverImageSyncedAt: null,
    };
    expect(getBookCoverUrl(book)).toBe('');
  });
});

describe('api token helpers', () => {
  it('stores and reads token from localStorage', () => {
    expect(api.isLoggedIn()).toBe(false);
    api.setToken('abc');
    expect(localStorage.getItem('novel_lib_token')).toBe('abc');
    expect(api.isLoggedIn()).toBe(true);
  });

  it('removes token on logout', () => {
    api.setToken('abc');
    api.logout();
    expect(api.isLoggedIn()).toBe(false);
  });

  it('returns google login URL', () => {
    expect(api.getGoogleLoginUrl()).toBe(`${API_BASE_URL}/auth/google`);
  });
});

describe('api request layer', () => {
  beforeEach(() => {
    api.setToken('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    api.logout();
  });

  const mockFetch = (overrides?: Record<string, unknown>) => {
    const response = {
      ok: true,
      status: 200,
      headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: vi.fn().mockResolvedValue({ user: { id: '1', username: 'u', email: 'u@test' } }),
      text: vi.fn().mockResolvedValue(''),
      ...overrides,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    return response;
  };

  it('sends Authorization header from localStorage token', async () => {
    mockFetch();
    await api.getMe();
    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/auth/me`);
    expect((options as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });

  it('serializes JSON body and Content-Type', async () => {
    mockFetch();
    await api.login('a@b.com', 'pass');
    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options as RequestInit).method).toBe('POST');
    expect((options as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect((options as RequestInit).body).toBe(JSON.stringify({ email: 'a@b.com', password: 'pass' }));
  });

  it('stores token after successful login', async () => {
    mockFetch({ json: vi.fn().mockResolvedValue({ token: 'new-token', user: { id: '1', username: 'u', email: 'u@test' } }) });
    await api.login('a@b.com', 'pass');
    expect(localStorage.getItem('novel_lib_token')).toBe('new-token');
  });

  it('throws ApiError on non-ok JSON responses', async () => {
    mockFetch({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
    });
    await expect(api.getMe()).rejects.toBeInstanceOf(ApiError);
    await expect(api.getMe()).rejects.toMatchObject({ status: 401, message: 'Unauthorized' });
  });

  it('throws ApiError with text fallback for non-JSON errors', async () => {
    mockFetch({
      ok: false,
      status: 500,
      headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/html' : null) },
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });
    await expect(api.getMe()).rejects.toMatchObject({ status: 500, message: 'Internal Server Error' });
  });

  it('throws a timeout ApiError when aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
    );
    await expect(api.getMe()).rejects.toMatchObject({
      status: 0,
      message: 'The request timed out. Check the backend and try again.',
    });
  });

  it('dispatches api-error event for failures', async () => {
    const listener = vi.fn();
    window.addEventListener('novels-library:api-error', listener as EventListener);
    mockFetch({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'boom' }),
    });
    await expect(api.getMe()).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('novels-library:api-error', listener as EventListener);
  });

  it('does not dispatch api-error event for 401 responses', async () => {
    const listener = vi.fn();
    window.addEventListener('novels-library:api-error', listener as EventListener);
    mockFetch({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
    });
    await expect(api.getMe()).rejects.toBeInstanceOf(ApiError);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('novels-library:api-error', listener as EventListener);
  });

  it('builds public catalog query with filters and pagination', async () => {
    mockFetch({ json: vi.fn().mockResolvedValue({ books: [], total: 0, page: 1, pageSize: 12, totalPages: 0 }) });
    await api.getPublicCatalogBooksPaginated({
      search: 'lord',
      genre: 'fantasy',
      status: 'reading',
      sort: 'rating',
      sortDir: 'desc',
      page: 2,
      pageSize: 24,
    });
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.searchParams.get('search')).toBe('lord');
    expect(parsed.searchParams.get('genre')).toBe('fantasy');
    expect(parsed.searchParams.get('status')).toBe('reading');
    expect(parsed.searchParams.get('sort')).toBe('rating');
    expect(parsed.searchParams.get('sortDir')).toBe('desc');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('pageSize')).toBe('24');
  });

  it('defaults public paginated query to page 1', async () => {
    mockFetch({ json: vi.fn().mockResolvedValue({ books: [], total: 0, page: 1, pageSize: 12, totalPages: 0 }) });
    await api.getPublicCatalogBooksPaginated({});
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.searchParams.get('page')).toBe('1');
    expect(parsed.searchParams.get('pageSize')).toBeNull();
  });
});
