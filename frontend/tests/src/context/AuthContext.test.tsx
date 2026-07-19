import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import type { User } from '@/utils/api';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  api.logout();
});

function TestConsumer() {
  const { user, loading, hasCapability } = useAuth();
  if (loading) return <div data-testid="loading">Loading</div>;
  if (!user) return <div data-testid="guest">Guest</div>;
  return (
    <div>
      <span data-testid="user">{user.username}</span>
      <span data-testid="can-read">{hasCapability('books:read') ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  it('throws when useAuth is called outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const BadComponent = () => {
      useAuth();
      return null;
    };
    expect(() => render(<BadComponent />)).toThrow();
    consoleSpy.mockRestore();
  });

  it('sets initial user from a valid JWT token', async () => {
    const payload = btoa(JSON.stringify({ id: 'u1', email: 'u@test' }));
    api.setToken(`valid.${payload}.sig`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: vi.fn().mockResolvedValue({
          user: { id: 'u1', username: 'Reader', email: 'u@test', capabilities: ['books:read'] } as User,
        }),
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Reader'));
    expect(screen.getByTestId('can-read')).toHaveTextContent('yes');
  });

  it('logs out and clears token on 401', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = btoa(JSON.stringify({ id: 'u1', email: 'u@test' }));
    api.setToken(`invalid.${payload}.sig`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('guest')).toBeInTheDocument());
    expect(api.isLoggedIn()).toBe(false);
    consoleErrorSpy.mockRestore();
  });
});
