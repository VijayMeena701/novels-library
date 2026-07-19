import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ToggleRow } from '@/components/ui/toggle-row';

describe('ToggleRow', () => {
  it('renders label and switch', () => {
    render(<ToggleRow label="Notifications" checked={false} onChange={vi.fn()} />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('toggles on row click', async () => {
    const onChange = vi.fn();
    render(<ToggleRow label="Dark mode" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByText('Dark mode'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', async () => {
    const onChange = vi.fn();
    render(<ToggleRow label="Locked" checked={false} onChange={onChange} disabled />);
    await userEvent.click(screen.getByText('Locked'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
