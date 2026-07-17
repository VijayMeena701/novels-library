import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BooksPagination } from './BooksPagination';

describe('BooksPagination', () => {
  it('displays showing range and page count', () => {
    render(<BooksPagination page={2} pageSize={12} total={100} totalPages={9} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />);
    expect(screen.getByText('Showing 13-24 of 100')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 9')).toBeInTheDocument();
  });

  it('disables previous and first on page 1', () => {
    render(<BooksPagination page={1} pageSize={12} total={100} totalPages={9} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'First' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('disables next and last on last page', () => {
    render(<BooksPagination page={9} pageSize={12} total={100} totalPages={9} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last' })).toBeDisabled();
  });

  it('calls onPageChange for navigation buttons', async () => {
    const onPageChange = vi.fn();
    render(<BooksPagination page={2} pageSize={12} total={100} totalPages={9} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageSizeChange when per-page select changes', async () => {
    const onPageSizeChange = vi.fn();
    render(<BooksPagination page={1} pageSize={12} total={100} totalPages={9} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), '48');
    expect(onPageSizeChange).toHaveBeenCalledWith(48);
  });

  it('shows "No results" when total is 0', () => {
    render(<BooksPagination page={1} pageSize={12} total={0} totalPages={0} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
