import { cn } from '../../lib/utils';

export interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div className={cn('grid auto-cols-fr grid-flow-col overflow-hidden rounded-lg border border-reader', className)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            'min-h-9 border-r border-reader px-2 py-1.5 text-[0.7rem] font-medium capitalize transition-colors last:border-r-0 focus:outline-none focus:ring-2 focus:ring-reader-accent focus:ring-inset',
            value === option
              ? 'bg-reader-accent text-reader-surface'
              : 'bg-reader-surface text-reader-paragraph hover:bg-reader-controls',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
