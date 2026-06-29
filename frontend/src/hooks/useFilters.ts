// ═══════════════════════════════════════════════════════════
// useFilters — переиспользуемый хук для управления фильтрами.
//
// Устраняет дублирование: каждая страница с таблицей/списком
// повторяла одни и те же useState + useEffect + buildParams.
//
// Использование:
//   const filters = useFilters({ tab: 'active' });
//   filters.setTab('new');
//   const params = filters.buildParams();
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';

export interface FilterState {
  tab: string;
  groupFilter: string;
  brandFilter: string;
  modelFilter: string;
  masterFilter: string;
  createdFrom: string;
  createdTo: string;
  searchFilter: string;
  clientFilter: string;
}

const INITIAL_STATE: FilterState = {
  tab: 'active',
  groupFilter: '',
  brandFilter: '',
  modelFilter: '',
  masterFilter: '',
  createdFrom: '',
  createdTo: '',
  searchFilter: '',
  clientFilter: '',
};

export function useFilters(initial: Partial<FilterState> = {}) {
  const [state, setState] = useState<FilterState>({ ...INITIAL_STATE, ...initial });

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const hasActiveFilters = Boolean(
    state.brandFilter || state.modelFilter || state.masterFilter ||
    state.createdFrom || state.createdTo || state.searchFilter || state.clientFilter,
  );

  /**
   * Строит параметры для API-запроса (getOrders, getParts, и т.д.)
   */
  const buildParams = useCallback((overrides?: Partial<FilterState>): Record<string, string> => {
    const s = { ...state, ...overrides };
    const p: Record<string, string> = { limit: '100' };

    if (s.tab && s.tab !== 'active' && s.tab !== 'my' && s.tab !== 'overdue') p.status = s.tab;
    if (s.tab === 'overdue') p.overdue = 'true';
    if (s.tab === 'my') p.my = 'true';
    if (s.groupFilter) p.group_id = s.groupFilter;
    if (s.brandFilter) p.brand = s.brandFilter;
    if (s.modelFilter) p.model = s.modelFilter;
    if (s.masterFilter) p.master_id = s.masterFilter;
    if (s.createdFrom) p.created_from = s.createdFrom;
    if (s.createdTo) p.created_to = s.createdTo;
    if (s.searchFilter) p.search = s.searchFilter;
    if (s.clientFilter) p.client_id = s.clientFilter;

    return p;
  }, [state]);

  return {
    ...state,
    setTab: (tab: string) => setFilter('tab', tab),
    setGroupFilter: (v: string) => setFilter('groupFilter', v),
    setBrandFilter: (v: string) => setFilter('brandFilter', v),
    setModelFilter: (v: string) => setFilter('modelFilter', v),
    setMasterFilter: (v: string) => setFilter('masterFilter', v),
    setCreatedFrom: (v: string) => setFilter('createdFrom', v),
    setCreatedTo: (v: string) => setFilter('createdTo', v),
    setSearchFilter: (v: string) => setFilter('searchFilter', v),
    setClientFilter: (v: string) => setFilter('clientFilter', v),
    resetFilters,
    hasActiveFilters,
    buildParams,
  } as const;
}
