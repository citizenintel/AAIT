import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';

export function useURLSync() {
  const modules = useAppStore((s) => s.filters.modules);
  const province = useAppStore((s) => s.filters.province);
  const searchQuery = useAppStore((s) => s.filters.searchQuery);
  const viewMode = useAppStore((s) => s.ui.viewMode);
  const setProvince = useAppStore((s) => s.setProvince);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setModuleFilter = useAppStore((s) => s.setModuleFilter);

  const initialized = useRef(false);

  // On mount: read hash and apply state
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const hash = window.location.hash.substring(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);

    if (params.has('province')) setProvince(params.get('province'));
    if (params.has('q')) setSearchQuery(params.get('q')!);
    if (params.has('view')) {
      const v = params.get('view');
      if (v === 'list' || v === 'map') setViewMode(v);
    }
    if (params.has('modules_off')) {
      const off = params.get('modules_off')!.split(',');
      for (const m of off) {
        setModuleFilter(m as Parameters<typeof setModuleFilter>[0], false);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On state change: write hash
  useEffect(() => {
    if (!initialized.current) return;

    const state: Record<string, string> = {};

    const offModules = Object.entries(modules)
      .filter(([, v]) => v === false)
      .map(([k]) => k);
    if (offModules.length > 0) state.modules_off = offModules.join(',');
    if (province) state.province = province;
    if (searchQuery) state.q = searchQuery;
    if (viewMode !== 'map') state.view = viewMode;

    const hash = new URLSearchParams(state).toString();
    const newUrl = hash
      ? `${window.location.pathname}${window.location.search}#${hash}`
      : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', newUrl);
  }, [modules, province, searchQuery, viewMode]);
}
