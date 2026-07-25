import { useEffect } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type Author,
  type CatalogBookFilters,
  type Genre,
  type PaginatedBooks,
  type PublicationStatus,
  type Source,
} from '../utils/api';
import { booksCatalogKey, booksCatalogOptionsKey } from '../lib/query-keys';

interface CatalogOptions {
  genres: Genre[];
  publicationStatuses: PublicationStatus[];
  sources: Source[];
  authors: Author[];
}

const EMPTY_OPTIONS: CatalogOptions = {
  genres: [],
  publicationStatuses: [],
  sources: [],
  authors: [],
};

export function useBooksCatalog(filters: CatalogBookFilters) {
  const queryClient = useQueryClient();

  const catalogQuery = useQuery<PaginatedBooks>({
    queryKey: booksCatalogKey(filters),
    queryFn: () => api.getPublicCatalogBooksPaginated(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const optionsQuery = useQuery<CatalogOptions>({
    queryKey: booksCatalogOptionsKey,
    queryFn: async () => {
      const [genres, publicationStatuses, authors, sources] = await Promise.all([
        api.getPublicGenres(),
        api.getPublicPublicationStatuses(),
        api.getPublicAuthors(),
        api.getSources(),
      ]);
      return { genres, publicationStatuses, authors, sources };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const data = catalogQuery.data;
    if (!data || data.page !== filters.page || data.page >= data.totalPages) return;

    const nextFilters = { ...filters, page: data.page + 1 };
    void queryClient
      .prefetchQuery({
        queryKey: booksCatalogKey(nextFilters),
        queryFn: () => api.getPublicCatalogBooksPaginated(nextFilters),
        staleTime: 60 * 1000,
        retry: false,
      })
      .catch(() => {});
  }, [catalogQuery.data, filters, queryClient]);

  return {
    result: catalogQuery.data ?? null,
    isLoading: catalogQuery.isLoading,
    isFetching: catalogQuery.isFetching,
    error: catalogQuery.error,
    options: optionsQuery.data ?? EMPTY_OPTIONS,
    optionsLoading: optionsQuery.isLoading,
  };
}
