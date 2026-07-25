import * as React from 'react';
import { cn } from '../../lib/utils';
import { inputVariants, textareaVariants, selectVariants } from '../../design-system/components/input';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
 ({ className, ...props }, ref) => (
 <input ref={ref} className={cn(inputVariants(), className)} {...props} />
 ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
 ({ className, ...props }, ref) => (
 <textarea ref={ref} className={cn(textareaVariants(), className)} {...props} />
 ),
);
Textarea.displayName = 'Textarea';

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
 ({ className, ...props }, ref) => (
 <select ref={ref} className={cn(selectVariants(), className)} {...props} />
 ),
);
Select.displayName = 'Select';

export { Input, Select, Textarea };
