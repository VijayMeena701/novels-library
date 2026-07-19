import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Boom');
  }
  return <div data-testid="ok">OK</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary name="Library">
        <ThrowError shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Library unavailable/)).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('resets and re-renders children after the error is resolved', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary name="Library">
        <ThrowError shouldThrow />
      </ErrorBoundary>,
    );
    rerender(
      <ErrorBoundary name="Library">
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(screen.getByTestId('ok')).toBeInTheDocument();
    spy.mockRestore();
  });
});
