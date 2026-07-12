"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type CatalogBookFilters, type BookStatus, type PaginatedBooks, type Author, type Genre, type PublicationStatus, type Source } from "../../utils/api";
import { BookCard } from "../../components/BookCard";
import { BooksFilterPanel } from "../../components/BooksFilterPanel";
import { BooksPagination } from "../../components/BooksPagination";
import { Card } from "../../components/ui/card";

const READING_STATUSES: { value: BookStatus; label: string }[] = [
	{ value: "reading", label: "Reading" },
	{ value: "completed", label: "Completed" },
	{ value: "on_hold", label: "On Hold" },
	{ value: "dropped", label: "Dropped" },
	{ value: "planning", label: "Planning" },
];

function parseNumberParam(value: string | null, fallback: number): number {
	if (value === null || value === "") return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNumberParam(value: string | null): number | undefined {
	if (value === null || value === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseFilters(searchParams: URLSearchParams): CatalogBookFilters {
	return {
		search: searchParams.get("search") || undefined,
		genre: searchParams.get("genre") || undefined,
		source: searchParams.get("source") || undefined,
		publicationStatus: searchParams.get("publicationStatus") || undefined,
		status: (searchParams.get("status") as BookStatus | "all") || "all",
		authorId: searchParams.get("authorId") || undefined,
		minRating: parseOptionalNumberParam(searchParams.get("minRating")),
		maxRating: parseOptionalNumberParam(searchParams.get("maxRating")),
		sort: (searchParams.get("sort") as CatalogBookFilters["sort"]) || "updatedAt",
		sortDir: (searchParams.get("sortDir") as "asc" | "desc") || "desc",
		page: parseNumberParam(searchParams.get("page"), 1),
		pageSize: parseNumberParam(searchParams.get("pageSize"), 24),
	};
}

function buildQueryString(filters: CatalogBookFilters): string {
	const params = new URLSearchParams();

	if (filters.search) params.set("search", filters.search);
	if (filters.genre) params.set("genre", filters.genre);
	if (filters.source) params.set("source", filters.source);
	if (filters.publicationStatus) params.set("publicationStatus", filters.publicationStatus);
	if (filters.status && filters.status !== "all") params.set("status", filters.status);
	if (filters.authorId) params.set("authorId", filters.authorId);
	if (filters.minRating !== undefined && filters.minRating !== null) params.set("minRating", String(filters.minRating));
	if (filters.maxRating !== undefined && filters.maxRating !== null) params.set("maxRating", String(filters.maxRating));
	if (filters.sort && filters.sort !== "updatedAt") params.set("sort", filters.sort);
	if (filters.sortDir && filters.sortDir !== "desc") params.set("sortDir", filters.sortDir);
	if (filters.page !== 1) params.set("page", String(filters.page));
	if (filters.pageSize !== 24) params.set("pageSize", String(filters.pageSize));

	const query = params.toString();
	return query ? `?${query}` : "";
}

function BooksPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const searchParamsKey = searchParams.toString();

	// searchParamsKey is derived from searchParams and is stable for comparison.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const filters = useMemo(() => parseFilters(searchParams), [searchParamsKey]);

	const [result, setResult] = useState<PaginatedBooks | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [options, setOptions] = useState<{
		genres: Genre[];
		publicationStatuses: PublicationStatus[];
		sources: Source[];
		authors: Author[];
		readingStatuses: { value: BookStatus; label: string }[];
	}>({
		genres: [],
		publicationStatuses: [],
		sources: [],
		authors: [],
		readingStatuses: READING_STATUSES,
	});

	useEffect(() => {
		let cancelled = false;
		api
			.getPublicCatalogBooksPaginated(filters)
			.then((data) => {
				if (!cancelled) {
					setResult(data);
					setError(null);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err.message || "Failed to load books.");
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [filters]);

	useEffect(() => {
		let cancelled = false;
		Promise.all([api.getPublicGenres(), api.getPublicPublicationStatuses(), api.getPublicAuthors(), api.getSources()])
			.then(([genres, publicationStatuses, authors, sources]) => {
				if (!cancelled) {
					setOptions({
						genres,
						publicationStatuses,
						sources,
						authors,
						readingStatuses: READING_STATUSES,
					});
				}
			})
			.catch((err) => console.error("Failed to load filter options:", err));
		return () => {
			cancelled = true;
		};
	}, []);

	const updateFilters = (next: CatalogBookFilters) => {
		setLoading(true);
		router.push(`/books${buildQueryString(next)}`, { scroll: false });
	};

	const handleFilterChange = (partial: Partial<CatalogBookFilters>) => {
		updateFilters({ ...filters, ...partial, page: 1 });
	};

	const handlePageChange = (page: number) => {
		updateFilters({ ...filters, page });
	};

	const handlePageSizeChange = (pageSize: number) => {
		updateFilters({ ...filters, pageSize, page: 1 });
	};

	const handleClear = () => {
		updateFilters({
			search: undefined,
			genre: undefined,
			source: undefined,
			publicationStatus: undefined,
			status: "all",
			authorId: undefined,
			minRating: undefined,
			maxRating: undefined,
			sort: "updatedAt",
			sortDir: "desc",
			page: 1,
			pageSize: 24,
		});
	};

	return (
		<div className="container page-stack">
			<div className="page-header">
				<div>
					<h1 className="page-title">Books</h1>
					<p className="page-subtitle">Browse and filter the full catalog.</p>
				</div>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row">
				<aside className="w-full shrink-0 lg:w-72">
					<BooksFilterPanel filters={filters} options={options} onChange={handleFilterChange} onClear={handleClear} />
				</aside>

				<main className="flex min-w-0 flex-1 flex-col gap-4">
					{error ? (
						<Card className="p-6 text-center text-red-700">{error}</Card>
					) : loading && !result ? (
						<div className="flex items-center justify-center py-16">
							<div className="spinner" />
						</div>
					) : result?.books.length === 0 ? (
						<Card className="p-6 text-center text-muted-copy">No books match your filters.</Card>
					) : (
						<>
							<div className="catalog-card-grid">
								{result?.books.map((book) => <BookCard key={book._id} book={book} mode="catalog" />)}
							</div>
							{result && (
								<BooksPagination
									page={result.page}
									pageSize={result.pageSize}
									total={result.total}
									totalPages={result.totalPages}
									onPageChange={handlePageChange}
									onPageSizeChange={handlePageSizeChange}
								/>
							)}
						</>
					)}
				</main>
			</div>
		</div>
	);
}

export default function BooksPage() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center py-16">
					<div className="spinner" />
				</div>
			}
		>
			<BooksPageContent />
		</Suspense>
	);
}
