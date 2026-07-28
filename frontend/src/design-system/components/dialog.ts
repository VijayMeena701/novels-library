import { cva } from 'class-variance-authority';

export const dialogOverlayVariants = cva(
  'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-[2px]',
);

export const dialogPanelVariants = cva(
  'w-full max-h-[90vh] flex flex-col overflow-hidden rounded-lg border border-default bg-card text-primary shadow-elevation-5',
);

export const dialogHeaderVariants = cva('flex items-start justify-between gap-3 border-b border-default p-4');

export const dialogCloseButtonVariants = cva(
  'flex size-8 shrink-0 items-center justify-center rounded-md border border-default text-muted transition hover:bg-surface-raised hover:text-accent',
);
