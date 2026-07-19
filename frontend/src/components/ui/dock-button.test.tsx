import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DockButton } from './dock-button';

describe('DockButton', () => {
  it('renders label and children', async () => {
    const onClick = vi.fn();
    render(
      <DockButton label="Home" onClick={onClick}>
        <span data-testid="icon" />
      </DockButton>,
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled and does not fire click', async () => {
    const onClick = vi.fn();
    render(
      <DockButton label="Locked" disabled>
        <span />
      </DockButton>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
