"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input, Select } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { type CatalogBookFilters, type Genre, type PublicationStatus, type Source, type Author, type BookStatus } from "../utils/api";

interface ReadingStatusOption {
	value: BookStatus;
	label: string;
}

interface BooksFilterPanelProps {
	filters: CatalogBookFilters;
	options: {
		genres: Genre[];
		publicationStatuses: PublicationStatus[];
		sources: Source[];
		authors: Author[];
		readingStatuses: ReadingStatusOption[];
	};
	onChange: (filters: Partial<CatalogBookFilters>) => void;
	onClear: () => void;
}

function getSelectedKeys(value: string | undefined): string[] {
	return value ? value.split(",").filter(Boolean) : [];
}

function toggleKey(current: string | undefined, key: string): string | undefined {
	const selected = getSelectedKeys(current);
	const index = selected.indexOf(key);
	const next = index >= 0 ? selected.filter((k) => k !== key) : [...selected, key];
	return next.length > 0 ? next.join(",") : undefined;
}

function getActiveFilterCount(filters: CatalogBookFilters): number {
	let count = 0;
	if (filters.search) count++;
	if (filters.genre) count += filters.genre.split(",").filter(Boolean).length;
	if (filters.publicationStatus) count += filters.publicationStatus.split(",").filter(Boolean).length;
	if (filters.source) count += filters.source.split(",").filter(Boolean).length;
	if (filters.status && filters.status !== "all") count++;
	if (filters.authorId) count++;
	if (filters.minRating !== undefined && filters.minRating !== null) count++;
	if (filters.maxRating !== undefined && filters.maxRating !== null) count++;
	return count;
}

export function BooksFilterPanel({ filters, options, onChange, onClear }: BooksFilterPanelProps) {
	const activeCount = getActiveFilterCount(filters);
	const [search, setSearch] = useState(filters.search || "");

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSearch(filters.search || "");
	}, [filters.search]);

	const handleToggle = (field: keyof CatalogBookFilters, key: string) => {
		onChange({ [field]: toggleKey(filters[field] as string | undefined, key) } as Partial<CatalogBookFilters>);
	};

	return (
		<Card className="h-fit">
			<CardHeader className="flex flex-row items-center justify-between gap-2">
				<CardTitle>Filters</CardTitle>
				{activeCount > 0 && <Badge variant="default">{activeCount}</Badge>}
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				<div className="grid gap-2">
					<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Search</label>
					<Input
						type="text"
						placeholder="Title, author, pen name..."
						value={search}
						onChange={(e) => {
							const value = e.target.value;
							setSearch(value);
							onChange({ search: value || undefined });
						}}
					/>
				</div>

				<div className="grid gap-2">
					<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Sort by</label>
					<div className="flex gap-2">
						<Select
							value={filters.sort || "updatedAt"}
							onChange={(e) => onChange({ sort: e.target.value as CatalogBookFilters["sort"] })}
							className="min-w-0 flex-1"
						>
							<option value="updatedAt">Updated</option>
							<option value="createdAt">Added</option>
							<option value="title">Title</option>
							<option value="author">Author</option>
							<option value="translatedChaptersTotal">Chapters</option>
							<option value="rawChaptersTotal">Raw chapters</option>
							<option value="rating">Rating</option>
							<option value="publicationStatus">Publication status</option>
							<option value="originalSource">Source</option>
						</Select>
						<Button
							variant="secondary"
							size="icon"
							className="shrink-0"
							onClick={() => onChange({ sortDir: filters.sortDir === "asc" ? "desc" : "asc" })}
							title={filters.sortDir === "asc" ? "Ascending" : "Descending"}
						>
							{filters.sortDir === "asc" ? "↑" : "↓"}
						</Button>
					</div>
				</div>

				<div className="grid gap-2">
					<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Reading status</label>
					<Select
						value={filters.status || "all"}
						onChange={(e) => onChange({ status: e.target.value as BookStatus | "all" })}
					>
						<option value="all">All</option>
						{options.readingStatuses.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</Select>
				</div>

				<div className="grid gap-2">
					<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Author</label>
					<Select
						value={filters.authorId || ""}
						onChange={(e) => onChange({ authorId: e.target.value || undefined })}
					>
						<option value="">All authors</option>
						{options.authors.map((author) => (
							<option key={author._id} value={author._id}>
								{author.displayName} {author.bookCount ? `(${author.bookCount})` : ""}
							</option>
						))}
					</Select>
				</div>

				{options.genres.length > 0 && (
					<div className="grid gap-2">
						<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Genres</label>
						<div className="flex max-h-[180px] flex-col gap-1.5 overflow-y-auto pr-1">
							{options.genres.map((genre) => {
								const selected = getSelectedKeys(filters.genre).includes(genre.key);
								return (
									<label
										key={genre._id}
										className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition ${selected ? "bg-primary-soft font-bold text-foreground" : "text-copy hover:bg-surface-muted"}`}
									>
										<input
											type="checkbox"
											checked={selected}
											onChange={() => handleToggle("genre", genre.key)}
											className="size-4 accent-primary"
										/>
										<span className="flex-1 truncate">{genre.name}</span>
										{genre.bookCount ? <span className="text-xs text-muted-copy">{genre.bookCount}</span> : null}
									</label>
								);
								})}
							</div>
						</div>
					)}

				{options.publicationStatuses.length > 0 && (
					<div className="grid gap-2">
						<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Publication status</label>
						<div className="flex max-h-[180px] flex-col gap-1.5 overflow-y-auto pr-1">
							{options.publicationStatuses.map((status) => {
								const selected = getSelectedKeys(filters.publicationStatus).includes(status.key);
								return (
									<label
										key={status._id}
										className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition ${selected ? "bg-primary-soft font-bold text-foreground" : "text-copy hover:bg-surface-muted"}`}
									>
										<input
											type="checkbox"
											checked={selected}
											onChange={() => handleToggle("publicationStatus", status.key)}
											className="size-4 accent-primary"
										/>
										<span className="flex-1 truncate">{status.name}</span>
										{status.bookCount ? <span className="text-xs text-muted-copy">{status.bookCount}</span> : null}
									</label>
								);
								})}
							</div>
						</div>
					)}

				{options.sources.length > 0 && (
					<div className="grid gap-2">
						<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Source</label>
						<div className="flex max-h-[160px] flex-col gap-1.5 overflow-y-auto pr-1">
							{options.sources.map((source) => {
								const selected = getSelectedKeys(filters.source).includes(source.key);
								return (
									<label
										key={source.key}
										className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition ${selected ? "bg-primary-soft font-bold text-foreground" : "text-copy hover:bg-surface-muted"}`}
									>
										<input
											type="checkbox"
											checked={selected}
											onChange={() => handleToggle("source", source.key)}
											className="size-4 accent-primary"
										/>
										<span className="flex-1 truncate">{source.name}</span>
										{source.count ? <span className="text-xs text-muted-copy">{source.count}</span> : null}
									</label>
								);
								})}
							</div>
						</div>
					)}

				<div className="grid gap-2">
					<label className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">Rating</label>
					<div className="flex gap-2">
						<Input
							type="number"
							min={0}
							max={5}
							step={0.5}
							placeholder="Min"
							value={filters.minRating ?? ""}
							onChange={(e) =>
								onChange({
									minRating: e.target.value ? Number(e.target.value) : undefined,
								})
							}
						/>
						<Input
							type="number"
							min={0}
							max={5}
							step={0.5}
							placeholder="Max"
							value={filters.maxRating ?? ""}
							onChange={(e) =>
								onChange({
									maxRating: e.target.value ? Number(e.target.value) : undefined,
								})
							}
						/>
					</div>
				</div>

				<Button variant="secondary" className="w-full" onClick={onClear}>
					Clear filters
				</Button>
			</CardContent>
		</Card>
	);
}
