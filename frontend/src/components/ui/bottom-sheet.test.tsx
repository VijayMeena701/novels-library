import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BottomSheet } from './bottom-sheet';

describe('BottomSheet', () => {
  it('is hidden when closed but still rendered off-screen', () => {
    const { container } = render(
      <BottomSheet isOpen={false} onOpenChange={vi.fn()}>
        Hidden
      </BottomSheet>,
    );
    const sheet = container.querySelector('.fixed.inset-x-0');
    expect(sheet).toHaveClass('translate-y-full');
  });

  it('shows content when open and renders header', () => {
    const { container } = render(
      <BottomSheet isOpen onOpenChange={vi.fn()} header={<span data-testid="header">Header</span>}>
        Content
      </BottomSheet>,
    );
    const sheet = container.querySelector('.fixed.inset-x-0');
    expect(sheet).toHaveClass('translate-y-0');
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when close button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet isOpen onOpenChange={onOpenChange}>
        Body
      </BottomSheet>,
    );
    await userEvent.click(screen.getByLabelText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when the backdrop is clicked', async () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <BottomSheet isOpen onOpenChange={onOpenChange} showHandle={false}>
        Body
      </BottomSheet>,
    );
    const backdrop = container.querySelector('[role="presentation"]');
    expect(backdrop).toBeInTheDocument();
    await userEvent.click(backdrop!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
