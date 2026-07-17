import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders children with default styling', () => {
    render(<Badge>Reading</Badge>);
    const badge = screen.getByText('Reading');
    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('SPAN');
  });

  it('applies variant-specific classes', () => {
    const { rerender } = render(<Badge variant="completed">Done</Badge>);
    expect(screen.getByText('Done')).toHaveClass('bg-[#ecf8ef]');

    rerender(<Badge variant="dropped">Dropped</Badge>);
    expect(screen.getByText('Dropped')).toHaveClass('bg-[#fff0ee]');
  });

  it('merges custom className', () => {
    render(<Badge className="custom-class">Label</Badge>);
    expect(screen.getByText('Label')).toHaveClass('custom-class');
  });
});
