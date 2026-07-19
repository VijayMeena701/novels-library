import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import LoginPage from '@/app/login/page';
import { AuthProvider } from '@/context/AuthContext';

describe('LoginPage', () => {
  it('renders login form and Google button', async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Continue with Google/i })).toBeInTheDocument();
    });
  });

  it('toggles between sign in and create account', async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Sign Up/i }));
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. book_reader')).toBeInTheDocument();
  });

  it('shows validation error for empty fields', async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Sign In/i }));
    expect(screen.getByText(/Please fill in all required fields/i)).toBeInTheDocument();
  });
});
