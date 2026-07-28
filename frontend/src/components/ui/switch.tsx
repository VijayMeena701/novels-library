import { cn } from '../../lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  theme?: 'default' | 'reader';
  'aria-label'?: string;
  disabled?: boolean;
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  theme = 'default',
  'aria-label': ariaLabel,
  disabled,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => {
        onCheckedChange(!checked);
        event.stopPropagation();
      }}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
        theme === 'reader'
          ? 'focus:ring-reader-accent focus:ring-offset-reader-bg'
          : 'focus:ring-accent focus:ring-offset-2',
        checked
          ? theme === 'reader'
            ? 'border-reader-accent bg-reader-accent'
            : 'border-accent bg-accent'
          : theme === 'reader'
            ? 'border-reader bg-reader-surface'
            : 'border-default bg-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          cn(
            'inline-block size-3.5 transform rounded-lg shadow-elevation-2 transition-transform duration-200',
            theme === 'reader' ? 'bg-reader' : 'bg-app',
          ),
          checked ? 'translate-x-4' : 'translate-x-1',
        )}
      />
    </button>
  );
}
