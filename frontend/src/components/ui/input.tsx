import * as React from 'react';
import { cn } from '../../lib/utils';

const inputClassName =
  'min-h-[42px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-[rgba(64,95,143,0.15)] placeholder:text-muted-copy disabled:cursor-not-allowed disabled:opacity-60';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClassName, className)} {...props} />
  ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClassName, 'min-h-28 resize-y', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(inputClassName, className)} {...props} />
  ),
);
Select.displayName = 'Select';

export { Input, Select, Textarea };
