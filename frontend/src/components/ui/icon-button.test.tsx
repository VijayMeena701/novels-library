import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('renders icon and label', async () => {
    const onClick = vi.fn();
    render(
      <IconButton icon={<span data-testid="icon" />} aria-label="Menu" onClick={onClick} />,
    );
    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies primary variant class', () => {
    render(<IconButton icon={<span />} variant="primary" aria-label="Primary" />);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
  });

  it('is disabled and does not fire click', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={<span />} disabled aria-label="Disabled" onClick={onClick} />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});
