'use client';

import { cn } from '@/lib/utils';

type ProgressBarSize = 'sm' | 'md' | 'lg';
type ProgressBarVariant = 'gradient' | 'solid';

interface ProgressBarProps {
  percent: number;
  size?: ProgressBarSize;
  variant?: ProgressBarVariant;
  className?: string;
  barClassName?: string;
}

const sizeClasses: Record<ProgressBarSize, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
};

export function ProgressBar({
  percent,
  size = 'sm',
  variant = 'gradient',
  className,
  barClassName,
}: ProgressBarProps) {
  const safePercent = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-full bg-surface-raised', sizeClasses[size], className)}
      role="progressbar"
      aria-valuenow={safePercent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          variant === 'gradient' ? 'bg-gradient-to-r from-primary to-accent' : 'bg-accent',
          barClassName,
        )}
        style={{ width: `${safePercent}%` }}
      />
    </div>
  );
}
