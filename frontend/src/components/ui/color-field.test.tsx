import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ColorField } from './color-field';

describe('ColorField', () => {
  it('renders color input and text input with initial value', () => {
    const { container } = render(<ColorField label="Accent" value="#ff0000" onChange={vi.fn()} />);
    expect(screen.getByText('Accent')).toBeInTheDocument();

    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;

    expect(colorInput).toHaveValue('#ff0000');
    expect(textInput).toHaveValue('#ff0000');
  });

  it('calls onChange when text input changes', async () => {
    const onChange = vi.fn();
    const { container } = render(<ColorField label="Accent" value="#000000" onChange={onChange} />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '#123abc' } });
    expect(onChange).toHaveBeenLastCalledWith('#123abc');
  });
});
