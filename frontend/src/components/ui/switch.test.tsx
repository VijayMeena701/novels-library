import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Switch } from './switch';

describe('Switch', () => {
  it('renders as a switch with aria-checked state', () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} aria-label="Enable" />);
    const sw = screen.getByRole('switch', { name: 'Enable' });
    expect(sw).toBeInTheDocument();
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles checked state on click', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch checked={false} onCheckedChange={onChange} aria-label="Toggle" />);
    const sw = screen.getByRole('switch');
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<Switch checked onCheckedChange={onChange} aria-label="Toggle" />);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('does not toggle when disabled', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} disabled aria-label="Disabled" />);
    const sw = screen.getByRole('switch');
    await userEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});
