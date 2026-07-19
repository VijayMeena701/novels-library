import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('renders with default medium size', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status', { name: /loading/i });
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('size-6');
  });

  it('supports size variants', () => {
    const { rerender } = render(<Spinner size="sm" />);
    expect(screen.getByRole('status')).toHaveClass('size-4');

    rerender(<Spinner size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('size-8');
  });

  it('merges custom className', () => {
    render(<Spinner className="mx-auto" />);
    expect(screen.getByRole('status')).toHaveClass('mx-auto');
  });
});
