"use client";

import { Button } from "./ui/button";
import { Select } from "./ui/input";

interface NovelsPaginationProps {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
}

export function NovelsPagination({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange }: NovelsPaginationProps) {
	const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const end = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
			<div className="text-sm text-muted-copy">
				{total === 0 ? "No results" : `Showing ${start}-${end} of ${total}`}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Button variant="secondary" size="sm" onClick={() => onPageChange(1)} disabled={page <= 1}>
					First
				</Button>
				<Button variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
					Previous
				</Button>
				<span className="px-2 text-sm font-bold text-foreground">
					Page {page} of {totalPages}
				</span>
				<Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
					Next
				</Button>
				<Button variant="secondary" size="sm" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
					Last
				</Button>
			</div>

			<div className="flex items-center gap-2">
				<label className="text-sm text-muted-copy">Per page</label>
				<Select
					value={String(pageSize)}
					onChange={(e) => onPageSizeChange(Number(e.target.value))}
					className="w-20"
				>
					<option value="12">12</option>
					<option value="24">24</option>
					<option value="48">48</option>
					<option value="96">96</option>
				</Select>
			</div>
		</div>
	);
}
