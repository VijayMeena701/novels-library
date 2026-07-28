import { cn } from '../../lib/utils';

export interface ToggleChipProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function ToggleChip({ label, checked, onChange, className, disabled }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'rounded-md border px-2.5 py-1.5 text-[0.7rem] font-bold transition focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-2',
        checked
          ? 'border-accent bg-accent-subtle text-primary'
          : 'border-default bg-surface text-muted hover:text-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {label}
    </button>
  );
}
