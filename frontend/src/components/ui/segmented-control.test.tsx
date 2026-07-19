import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SegmentedControl } from './segmented-control';

describe('SegmentedControl', () => {
  it('renders all options', () => {
    render(<SegmentedControl options={['light', 'dark', 'sepia'] as const} value="light" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sepia' })).toBeInTheDocument();
  });

  it('marks the active option', () => {
    const { rerender } = render(
      <SegmentedControl options={['a', 'b', 'c'] as const} value="a" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'a' })).toHaveClass('bg-primary');

    rerender(<SegmentedControl options={['a', 'b', 'c'] as const} value="b" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'b' })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: 'a' })).not.toHaveClass('bg-primary');
  });

  it('calls onChange with the selected option', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={['one', 'two'] as const} value="one" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'two' }));
    expect(onChange).toHaveBeenCalledWith('two');
  });
});
