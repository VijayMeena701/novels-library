import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex min-h-5 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium uppercase leading-none tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-surface-muted text-copy',
        outline: 'border border-border bg-transparent text-copy',
        reading: 'bg-[#edf4ff] text-[#2f5f9e]',
        completed: 'bg-[#ecf8ef] text-[#207346]',
        hold: 'bg-[#fff5df] text-[#9b5a10]',
        pending: 'bg-[#fff5df] text-[#9b5a10]',
        dropped: 'bg-[#fff0ee] text-[#a73b2f]',
        failed: 'bg-[#fff0ee] text-[#a73b2f]',
        planning: 'bg-[#f0eef8] text-[#5c517e]',
        processing: 'bg-primary-soft text-[#31517d] animate-pulse',
        requires_manual_intervention: 'bg-[#fff7ed] text-[#9a3412]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
