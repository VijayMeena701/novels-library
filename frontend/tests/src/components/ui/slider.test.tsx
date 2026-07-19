import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Slider } from '@/components/ui/slider';

describe('Slider', () => {
  it('renders label and current value', () => {
    render(<Slider label="Font size" value={16} min={12} max={24} step={1} onChange={vi.fn()} />);
    expect(screen.getByText('Font size')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
  });

  it('formats the displayed value', () => {
    render(
      <Slider
        label="Pitch"
        value={1.2}
        min={0.5}
        max={2}
        step={0.1}
        onChange={vi.fn()}
        formatValue={(v) => `${v.toFixed(1)}x`}
      />,
    );
    expect(screen.getByText('1.2x')).toBeInTheDocument();
  });

  it('calls onChange when the range input changes', async () => {
    const onChange = vi.fn();
    render(<Slider label="Volume" value={10} min={0} max={100} step={5} onChange={onChange} />);
    const input = screen.getByRole('slider');
    fireEvent.change(input, { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith(50);
  });
});
