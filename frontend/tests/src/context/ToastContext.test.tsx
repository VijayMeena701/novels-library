import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider, useToast } from '@/context/ToastContext';

describe('ToastProvider', () => {
  it('throws when useToast is called outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const BadComponent = () => {
      useToast();
      return null;
    };
    expect(() => render(<BadComponent />)).toThrow();
    consoleSpy.mockRestore();
  });

  it('displays a toast with the correct variant and title', async () => {
    function Trigger() {
      const { showToast } = useToast();
      return (
        <button onClick={() => showToast({ message: 'Saved', variant: 'success' })}>
          Show
        </button>
      );
    }

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('dismisses a toast when the close button is clicked', async () => {
    function Trigger() {
      const { showToast } = useToast();
      return <button onClick={() => showToast({ message: 'Info', variant: 'info' })}>Show</button>;
    }

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    await userEvent.click(screen.getByLabelText('Dismiss notification'));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('automatically displays toasts from the api-error event', async () => {
    render(
      <ToastProvider>
        <div data-testid="child">child</div>
      </ToastProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('novels-library:api-error', { detail: { message: 'Server error', variant: 'error' } }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
