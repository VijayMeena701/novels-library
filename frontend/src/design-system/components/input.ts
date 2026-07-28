import { cva, type VariantProps } from 'class-variance-authority';

export const inputVariants = cva(
  'min-h-10 w-full rounded-md border border-default/40 bg-surface px-3 py-2 text-sm text-primary outline-none transition placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60',
);

export const textareaVariants = cva(
  'min-h-24 w-full resize-y rounded-md border border-default/40 bg-surface px-3 py-2 text-sm text-primary outline-none transition placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60',
);

export const selectVariants = inputVariants;

export type InputVariantProps = VariantProps<typeof inputVariants>;
