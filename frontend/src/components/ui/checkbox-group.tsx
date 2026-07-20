
import { cn } from "../../lib/utils";

export interface CheckboxGroupItem {
	key: string;
	label: string;
	count?: number;
}

export interface CheckboxGroupProps {
	items: CheckboxGroupItem[];
	selectedKeys: string[];
	onToggle: (key: string) => void;
	className?: string;
	maxHeight?: string;
}

export function CheckboxGroup({ items, selectedKeys, onToggle, className, maxHeight = "180px" }: CheckboxGroupProps) {
	return (
		<div
			className={cn("flex flex-col gap-1.5 overflow-y-auto pr-1", className)}
			style={{ maxHeight }}
		>
			{items.map((item) => {
				const selected = selectedKeys.includes(item.key);
				return (
					<label
						key={item.key}
						className={cn(
							"flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition",
							selected ? "bg-primary-soft font-bold text-foreground" : "text-copy hover:bg-surface-muted",
						)}
					>
						<input
							type="checkbox"
							checked={selected}
							onChange={() => onToggle(item.key)}
							className="size-4 accent-primary"
						/>
						<span className="flex-1 truncate">{item.label}</span>
						{item.count !== undefined && item.count !== null && item.count > 0 ? (
							<span className="text-xs text-muted-copy">{item.count}</span>
						) : null}
					</label>
				);
			})}
		</div>
	);
}
