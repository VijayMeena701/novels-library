import { cva } from 'class-variance-authority';

export const navItemVariants = cva(
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-secondary transition hover:bg-surface-raised hover:text-primary',
);

export const navItemActiveVariants = cva(
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-surface-raised text-accent',
);
