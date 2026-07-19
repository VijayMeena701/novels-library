import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProfileForm } from '@/app/settings/ProfileForm';
import type { User } from '@/utils/api';

describe('ProfileForm', () => {
  const user: User = {
    id: 'u1',
    username: 'Reader',
    email: 'reader@example.com',
    avatarUrl: 'https://example.com/avatar.png',
  };

  it('renders username and email inputs', () => {
    render(<ProfileForm user={user} updateUser={vi.fn()} />);
    expect(screen.getByLabelText('Username')).toHaveValue('Reader');
    expect(screen.getByLabelText('Email')).toHaveValue('reader@example.com');
  });

  it('calls updateUser with trimmed values on submit', async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm user={user} updateUser={updateUser} />);

    await userEvent.clear(screen.getByLabelText('Username'));
    await userEvent.type(screen.getByLabelText('Username'), 'NewReader');

    await userEvent.click(screen.getByRole('button', { name: /Save Profile/i }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ username: 'NewReader', avatarUrl: 'https://example.com/avatar.png' }));
  });

  it('omits empty values when updating', async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm user={user} updateUser={updateUser} />);

    await userEvent.clear(screen.getByLabelText('Username'));
    await userEvent.clear(screen.getByLabelText('Avatar URL'));

    await userEvent.click(screen.getByRole('button', { name: /Save Profile/i }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ username: undefined, avatarUrl: undefined }));
  });

  it('shows error message when update fails', async () => {
    const updateUser = vi.fn().mockRejectedValue(new Error('Update failed'));
    render(<ProfileForm user={user} updateUser={updateUser} />);

    await userEvent.click(screen.getByRole('button', { name: /Save Profile/i }));
    await waitFor(() => expect(screen.getByText('Update failed')).toBeInTheDocument());
  });

  it('shows success message when update succeeds', async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm user={user} updateUser={updateUser} />);

    await userEvent.click(screen.getByRole('button', { name: /Save Profile/i }));
    await waitFor(() => expect(screen.getByText(/updated successfully/i)).toBeInTheDocument());
  });
});
