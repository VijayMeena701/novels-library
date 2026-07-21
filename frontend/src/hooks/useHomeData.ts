'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type Book, type HomeResponse, type User } from '../utils/api';
import { homeCatalogKey, homeLibraryKey, homeStatsKey } from '../lib/query-keys';

export interface UseHomeDataResult {
  books: Book[];
  libraryBooks: Book[];
  home: HomeResponse | null;
  loading: boolean;
  libraryLoading: boolean;
}

function normalizeCatalog(data: Book[] | { books?: Book[] }): Book[] {
  return Array.isArray(data) ? data : data.books || [];
}

export function useHomeData(user: User | null): UseHomeDataResult {
  const catalogQuery = useQuery({
    queryKey: homeCatalogKey,
    queryFn: () => api.getPublicCatalogBooksPaginated({ pageSize: 100 }),
    select: normalizeCatalog,
    staleTime: 5 * 60 * 1000,
  });

  const libraryQuery = useQuery({
    queryKey: [...homeLibraryKey, user?.id],
    queryFn: () => api.getBooks(),
    enabled: !!user,
    select: (data: Book[]) => data || [],
  });

  const homeQuery = useQuery({
    queryKey: [...homeStatsKey, user?.id],
    queryFn: () => api.getHome(),
    staleTime: 60 * 1000,
  });

  return {
    books: catalogQuery.data ?? [],
    libraryBooks: libraryQuery.data ?? [],
    home: homeQuery.data ?? null,
    loading: catalogQuery.isLoading,
    libraryLoading: libraryQuery.isLoading,
  };
}
