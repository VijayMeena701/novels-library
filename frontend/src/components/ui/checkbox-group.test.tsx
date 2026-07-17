import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CheckboxGroup } from './checkbox-group';

describe('CheckboxGroup', () => {
  const items = [
    { key: 'fantasy', label: 'Fantasy', count: 12 },
    { key: 'sci-fi', label: 'Sci-Fi' },
    { key: 'romance', label: 'Romance', count: 3 },
  ];

  it('renders checkboxes with labels and counts', () => {
    render(<CheckboxGroup items={items} selectedKeys={[]} onToggle={vi.fn()} />);
    expect(screen.getByLabelText(/Fantasy/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByLabelText(/Sci-Fi/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('checks selected items', () => {
    render(<CheckboxGroup items={items} selectedKeys={['sci-fi']} onToggle={vi.fn()} />);
    expect(screen.getByLabelText(/Sci-Fi/)).toBeChecked();
    expect(screen.getByLabelText(/Fantasy/)).not.toBeChecked();
  });

  it('calls onToggle with the item key when clicked', async () => {
    const onToggle = vi.fn();
    render(<CheckboxGroup items={items} selectedKeys={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByLabelText(/Romance/));
    expect(onToggle).toHaveBeenCalledWith('romance');
  });

  it('respects maxHeight style', () => {
    const { container } = render(<CheckboxGroup items={items} selectedKeys={[]} onToggle={vi.fn()} maxHeight="120px" />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.maxHeight).toBe('120px');
  });
});
