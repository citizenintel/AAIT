import { useMemo } from 'react';
import { useIncidentData } from './useIncidentData';
import { useAppStore } from '@/stores/app-store';
import type { MockIncident } from '@/data/mock-incidents';

export interface FilteredIncidentsResult {
  filtered: MockIncident[];
  total: number;
  activeFilterNames: string[];
  isFiltered: boolean;
}

export function useFilteredIncidents(): FilteredIncidentsResult {
  const { incidents } = useIncidentData();
  const modules = useAppStore((s) => s.filters.modules);
  const categories = useAppStore((s) => s.filters.categories);
  const severities = useAppStore((s) => s.filters.severities);
  const province = useAppStore((s) => s.filters.province);
  const searchQuery = useAppStore((s) => s.filters.searchQuery);

  return useMemo(() => {
    const activeFilterNames: string[] = [];

    const allModulesOn = Object.values(modules).every((v) => v !== false);
    const allCatsOn = Object.values(categories).every((v) => v !== false);
    const allSevsOn = Object.values(severities).every((v) => v !== false);

    if (!allModulesOn) {
      const offModules = Object.entries(modules).filter(([, v]) => v === false).map(([k]) => k);
      activeFilterNames.push(`-${offModules.length} modules`);
    }
    if (!allCatsOn) activeFilterNames.push('categories filtered');
    if (!allSevsOn) activeFilterNames.push('severity filtered');
    if (province) activeFilterNames.push(province);
    if (searchQuery) activeFilterNames.push(`"${searchQuery}"`);

    const filtered = incidents.filter((inc) => {
      if (modules[inc.module] === false) return false;
      if (categories[inc.category] === false) return false;
      if (severities[inc.severity] === false) return false;
      if (province && inc.province !== province) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          inc.title.toLowerCase().includes(q) ||
          inc.town.toLowerCase().includes(q) ||
          inc.province.toLowerCase().includes(q) ||
          inc.category.toLowerCase().includes(q) ||
          (inc.summary && inc.summary.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });

    return {
      filtered,
      total: incidents.length,
      activeFilterNames,
      isFiltered: activeFilterNames.length > 0,
    };
  }, [incidents, modules, categories, severities, province, searchQuery]);
}
