import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Field } from './field';

describe('Field', () => {
  it('renders label and children', () => {
    render(
      <Field label="Username">
        <input aria-label="Username input" />
      </Field>,
    );
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Username input')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(
      <Field label="Email" className="gap-4">
        <input />
      </Field>,
    );
    expect(container.firstChild).toHaveClass('gap-4');
  });
});
