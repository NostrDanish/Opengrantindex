import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useOgiIndex } from '@/hooks/useOgiIndex';
import {
  applyParsedQuery,
  buildIndex,
  countActiveFilters,
  facetCounts,
  filtersToParams,
  fundingTypeFacets,
  paramsToFilters,
  parseQuery,
  runSearch,
  type Facet,
  type ParsedQuery,
  type ScoredResult,
} from '@/lib/ogi/search';
import type { SearchFilters } from '@/lib/ogi/types';

export interface OgiSearchState {
  filters: SearchFilters;
  parsed: ParsedQuery;
  results: ScoredResult[];
  /** Facets computed over the corpus (not the result set) so counts stay stable. */
  topicFacets: Facet[];
  countryFacets: Facet[];
  typeFacets: Facet[];
  statusFacets: Facet[];
  activeFilterCount: number;
  totalIndexed: number;
  isSyncing: boolean;
  setFilters: (next: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => void;
  patchFilters: (patch: Partial<SearchFilters>) => void;
  toggleFilter: <K extends 'topics' | 'countries' | 'fundingTypes' | 'statuses'>(
    key: K,
    value: SearchFilters[K][number],
  ) => void;
  clearFilters: () => void;
}

/**
 * Search state, fully driven by the URL query string.
 *
 * Keeping filters in the URL means every search is shareable, bookmarkable and
 * back-button-friendly, and it is what makes saved searches (kind 30441) a
 * trivial serialization rather than a bespoke feature.
 */
export function useOgiSearch(): OgiSearchState {
  const [params, setParams] = useSearchParams();
  const { index, isSyncing } = useOgiIndex();

  const filters = useMemo(() => paramsToFilters(params), [params]);
  const parsed = useMemo(() => parseQuery(filters.q), [filters.q]);

  const searchIndex = useMemo(() => buildIndex(index.opportunities), [index.opportunities]);

  const results = useMemo(() => {
    const effective = applyParsedQuery(filters, parsed);
    return runSearch(searchIndex, { ...effective, q: filters.q, sort: filters.sort }, parsed);
  }, [searchIndex, filters, parsed]);

  const topicFacets = useMemo(() => facetCounts(index.opportunities, 'topics'), [index.opportunities]);
  const countryFacets = useMemo(() => facetCounts(index.opportunities, 'countries'), [index.opportunities]);
  const typeFacets = useMemo(() => fundingTypeFacets(index.opportunities), [index.opportunities]);
  const statusFacets = useMemo(() => facetCounts(index.opportunities, 'statuses'), [index.opportunities]);

  const setFilters = (next: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => {
    const value = typeof next === 'function' ? next(filters) : next;
    setParams(filtersToParams(value), { replace: false });
  };

  const patchFilters = (patch: Partial<SearchFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const toggleFilter = <K extends 'topics' | 'countries' | 'fundingTypes' | 'statuses'>(
    key: K,
    value: SearchFilters[K][number],
  ) => {
    setFilters((prev) => {
      const list = prev[key] as SearchFilters[K][number][];
      const has = list.includes(value);
      return {
        ...prev,
        [key]: has ? list.filter((v) => v !== value) : [...list, value],
      } as SearchFilters;
    });
  };

  const clearFilters = () => {
    setParams(filtersToParams({ ...filters, topics: [], countries: [], fundingTypes: [], statuses: [], funder: undefined, amountMin: undefined, amountMax: undefined, deadlineWithinDays: undefined, remoteOnly: false }));
  };

  return {
    filters,
    parsed,
    results,
    topicFacets,
    countryFacets,
    typeFacets,
    statusFacets,
    activeFilterCount: countActiveFilters(filters),
    totalIndexed: index.opportunities.length,
    isSyncing,
    setFilters,
    patchFilters,
    toggleFilter,
    clearFilters,
  };
}
