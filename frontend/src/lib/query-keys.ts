import { type CatalogBookFilters } from '../utils/api';

export const homeCatalogKey = ['home', 'catalog'] as const;
export const homeLibraryKey = ['home', 'library'] as const;
export const homeStatsKey = ['home', 'stats'] as const;

export const booksCatalogKey = (filters: CatalogBookFilters) => ['books', 'catalog', filters] as const;
export const booksCatalogOptionsKey = ['books', 'catalog', 'options'] as const;
