import { cva } from 'class-variance-authority';

export const cardVariants = cva('rounded-lg border border-default bg-card text-primary shadow-elevation-2 font-sans');

export const cardHeaderVariants = cva('flex flex-col gap-2 p-4');

export const cardTitleVariants = cva('text-base font-extrabold leading-tight');

export const cardDescriptionVariants = cva('text-sm text-secondary');

export const cardContentVariants = cva('p-4 pt-0');

export const cardFooterVariants = cva(
  'flex items-center justify-between gap-3 border-t border-default p-4 text-xs text-muted',
);
