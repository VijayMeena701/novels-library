"use client";

import { useCallback, useEffect, useMemo, useRef, Suspense, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type CatalogBookFilters } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useReaderSettings } from "../../hooks/useReaderSettings";
import { useBooksCatalog } from "../../hooks/useBooksCatalog";
import { BookCard } from "../../components/BookCard";
import { BooksFilterPanel } from "../../components/BooksFilterPanel";
import { BooksPagination } from "../../components/BooksPagination";
import { Card } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { applyReaderThemeCssVariables } from "../../lib/reader-theme";
import { cn } from "../../lib/utils";

function useDebouncedCallback(callback: () => void, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const schedule = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      callbackRef.current();
    }, delay);
  }, [delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    callbackRef.current();
  }, []);

  return useMemo(() => ({ schedule, cancel, flush }), [schedule, cancel, flush]);
}

const DEFAULT_FILTERS: CatalogBookFilters = {
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
};

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
    status: (searchParams.get("status") as CatalogBookFilters["status"]) || "all",
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
  const { user } = useAuth();
  const { theme: readerTheme } = useReaderSettings(user);
  const readerThemeStyle = useMemo(
    () => applyReaderThemeCssVariables(readerTheme) as CSSProperties,
    [readerTheme],
  );

  // searchParamsKey is derived from searchParams and is stable for comparison.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => parseFilters(searchParams), [searchParamsKey]);

  const { result, isLoading, error, options } = useBooksCatalog(filters);

  const pendingFiltersRef = useRef<CatalogBookFilters>(filters);
  useEffect(() => {
    pendingFiltersRef.current = filters;
  }, [filters, pendingFiltersRef]);

  const commit = useCallback(() => {
    router.replace(`/books${buildQueryString(pendingFiltersRef.current)}`, { scroll: false });
  }, [router, pendingFiltersRef]);

  const debounced = useDebouncedCallback(commit, 300);

  const applyFilters = useCallback(
    (next: CatalogBookFilters, debounce = false) => {
      pendingFiltersRef.current = next;
      if (debounce) {
        debounced.schedule();
      } else {
        debounced.flush();
      }
    },
    [debounced, pendingFiltersRef],
  );

  const handleFilterChange = useCallback(
    (partial: Partial<CatalogBookFilters>) => {
      applyFilters({ ...pendingFiltersRef.current, ...partial, page: 1 }, "search" in partial);
    },
    [applyFilters, pendingFiltersRef],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      applyFilters({ ...pendingFiltersRef.current, page }, false);
    },
    [applyFilters, pendingFiltersRef],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      applyFilters({ ...pendingFiltersRef.current, pageSize, page: 1 }, false);
    },
    [applyFilters, pendingFiltersRef],
  );

  const handleClear = useCallback(() => {
    applyFilters(DEFAULT_FILTERS, false);
  }, [applyFilters]);

  const errorMessage = error instanceof Error ? error.message : "Failed to load books.";

  return (
    <div
      className="reader-theme min-h-screen w-full bg-background"
      style={readerThemeStyle}
    >
      <div className={cn("mx-auto w-full max-w-[1280px] px-5 pb-16 pt-9 sm:px-6 lg:px-8", "flex flex-col gap-7")}>
        <div className="flex items-end justify-between gap-4 py-1">
          <div>
            <h1 className="text-[2.5rem] font-semibold leading-tight tracking-tight text-foreground">Books</h1>
            <p className="mt-2 text-[1.0625rem] text-muted-copy max-w-[720px]">Browse and filter the full catalog.</p>
          </div>
        </div>

        <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-7">
          <aside className="w-full shrink-0 lg:sticky lg:top-20">
            <BooksFilterPanel filters={filters} options={options} onChange={handleFilterChange} onClear={handleClear} />
          </aside>

          <main className="flex min-w-0 flex-1 flex-col gap-5">
            {error ? (
              <Card className="rounded-xl border-0 p-6 text-center text-danger">{errorMessage}</Card>
            ) : isLoading && !result ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="md" />
              </div>
            ) : result?.books.length === 0 ? (
              <Card className="rounded-xl border-0 p-6 text-center text-muted-copy">No books match your filters.</Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
    </div>
  );
}

export default function BooksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      }
    >
      <BooksPageContent />
    </Suspense>
  );
}
