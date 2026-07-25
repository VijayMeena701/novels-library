import { getStatusConfig } from './utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.badgeClass} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${config.dotClass}`} />
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
