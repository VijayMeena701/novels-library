import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-extrabold uppercase leading-none tracking-normal',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface text-[#5d6474]',
        outline: 'border-border bg-transparent text-copy',
        reading: 'border-[#c7dbfb] bg-[#edf4ff] text-[#2f5f9e]',
        completed: 'border-[#c7e8d0] bg-[#ecf8ef] text-[#207346]',
        hold: 'border-[#f2d7a5] bg-[#fff5df] text-[#9b5a10]',
        dropped: 'border-[#f3c7bf] bg-[#fff0ee] text-[#a73b2f]',
        planning: 'border-[#d8d1ed] bg-[#f0eef8] text-[#5c517e]',
        processing: 'border-[#c8d5eb] bg-primary-soft text-[#31517d]',
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
