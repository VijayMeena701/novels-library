import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Header from '@/components/Header';
import { AuthProvider } from '@/context/AuthContext';
import { api } from '@/utils/api';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  api.logout();
});

describe('Header', () => {
  it('renders public navigation and login button when unauthenticated', async () => {
    render(
      <AuthProvider>
        <Header />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Books' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    });
  });

  it('renders user menu and logout for authenticated user', async () => {
    const tokenPayload = btoa(JSON.stringify({ id: 'u1', email: 'u@test' }));
    api.setToken(`header.${tokenPayload}.sig`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: vi.fn().mockResolvedValue({
          user: { id: 'u1', username: 'Reader', email: 'u@test', capabilities: ['books:read'] },
        }),
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    render(
      <AuthProvider>
        <Header />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User menu')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows admin and scraper links when user has capabilities', async () => {
    const tokenPayload = btoa(JSON.stringify({ id: 'u1', email: 'u@test' }));
    api.setToken(`admin.${tokenPayload}.sig`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: vi.fn().mockResolvedValue({
          user: { id: 'u1', username: 'Admin', email: 'u@test', capabilities: ['jobs:list', 'admin:access'] },
        }),
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    render(
      <AuthProvider>
        <Header />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Scrapers' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
    });
  });
});
