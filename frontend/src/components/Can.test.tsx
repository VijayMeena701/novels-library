import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Can } from './Can';
import { useAuth } from '../context/AuthContext';
import { buildAbilityFor } from '../utils/ability';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Can', () => {
  it('renders children when ability allows the action', () => {
    const ability = buildAbilityFor(['books:read']);
    vi.mocked(useAuth).mockReturnValue({ ability } as ReturnType<typeof useAuth>);

    render(
      <Can action="read" subject="books">
        <span data-testid="allowed">Allowed</span>
      </Can>,
    );
    expect(screen.getByTestId('allowed')).toBeInTheDocument();
  });

  it('renders fallback when ability is missing', () => {
    const ability = buildAbilityFor([]);
    vi.mocked(useAuth).mockReturnValue({ ability } as ReturnType<typeof useAuth>);

    render(
      <Can action="delete" subject="books" fallback={<span data-testid="fallback">Denied</span>}>
        <span data-testid="allowed">Allowed</span>
      </Can>,
    );
    expect(screen.queryByTestId('allowed')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('renders fallback when ability is not available', () => {
    vi.mocked(useAuth).mockReturnValue({ ability: null } as unknown as ReturnType<typeof useAuth>);
    render(
      <Can action="read" subject="books" fallback={<span data-testid="fallback">No ability</span>}>
        <span data-testid="allowed">Allowed</span>
      </Can>,
    );
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });
});
