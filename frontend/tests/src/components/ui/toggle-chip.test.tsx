import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ToggleChip } from '@/components/ui/toggle-chip';

describe('ToggleChip', () => {
  it('renders label and toggles state on click', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ToggleChip label="Unread" checked={false} onChange={onChange} />);
    const chip = screen.getByRole('button', { name: 'Unread' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<ToggleChip label="Unread" checked onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not toggle when disabled', async () => {
    const onChange = vi.fn();
    render(<ToggleChip label="Disabled" checked={false} onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
