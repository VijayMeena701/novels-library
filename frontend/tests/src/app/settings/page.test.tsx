import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SettingsPage from '@/app/settings/page';
import { AuthProvider } from '@/context/AuthContext';
import { api } from '@/utils/api';

describe('SettingsPage', () => {
  it('shows loading state initially', () => {
    const payload = btoa(JSON.stringify({ id: 'u1', email: 'u@test' }));
    api.setToken(`settings.${payload}.sig`);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>,
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders the profile form when authenticated', async () => {
    const payload = btoa(JSON.stringify({ id: 'u1', email: 'u@test' }));
    api.setToken(`settings.${payload}.sig`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: vi.fn().mockResolvedValue({
          user: { id: 'u1', username: 'Reader', email: 'u@test', avatarUrl: '', capabilities: ['profile:update'] },
        }),
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    render(
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Email')).toHaveValue('u@test');
  });

  it('shows login prompt for unauthenticated users', async () => {
    api.logout();
    vi.stubGlobal('fetch', vi.fn());

    render(
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Please log in/i)).toBeInTheDocument();
    });
  });
});
