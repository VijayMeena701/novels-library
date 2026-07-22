import * as React from 'react';
import { cn } from '../../lib/utils';

const inputClassName =
  'min-h-[44px] w-full rounded-md border border-border/40 bg-surface px-3.5 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-copy focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60';

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
