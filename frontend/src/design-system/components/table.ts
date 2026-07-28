import { cva } from 'class-variance-authority';

export const tableContainerVariants = cva(
  'w-full overflow-x-auto rounded-lg border border-default bg-card shadow-elevation-2',
);

export const tableVariants = cva('w-full caption-bottom text-sm');

export const tableHeadVariants = cva('bg-surface-raised text-left text-xs font-extrabold uppercase text-secondary');

export const tableRowVariants = cva('border-b border-default transition hover:bg-surface-raised');

export const tableCellVariants = cva('p-4 align-middle text-primary');
