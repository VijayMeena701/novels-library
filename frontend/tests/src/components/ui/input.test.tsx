import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Input, Select, Textarea } from '@/components/ui/input';

describe('Input', () => {
  it('renders and forwards value changes', async () => {
    const onChange = vi.fn();
    render(<Input type="text" value="hello" onChange={onChange} aria-label="Test input" />);
    const input = screen.getByLabelText('Test input');
    expect(input).toBeInTheDocument();
    await userEvent.type(input, ' world');
    expect(onChange).toHaveBeenCalled();
  });

  it('merges custom className', () => {
    render(<Input className="extra" aria-label="Styled input" />);
    expect(screen.getByLabelText('Styled input')).toHaveClass('extra');
  });
});

describe('Select', () => {
  it('renders options and fires onChange', async () => {
    const onChange = vi.fn();
    render(
      <Select value="a" onChange={onChange} aria-label="Choose">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    const select = screen.getByLabelText('Choose');
    await userEvent.selectOptions(select, 'b');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Textarea', () => {
  it('renders as a textarea with min-height classes', () => {
    render(<Textarea aria-label="Notes" />);
    const textarea = screen.getByLabelText('Notes');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveClass('min-h-28');
  });
});
