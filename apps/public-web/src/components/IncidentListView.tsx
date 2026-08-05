import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULE_META, SEVERITY_META } from '@/data/mock-incidents';
import { useFilteredIncidents } from '@/lib/hooks/useFilteredIncidents';
import { useAppStore } from '@/stores/app-store';
import type { MockIncident } from '@/data/mock-incidents';

type SortKey = 'dateOccurred' | 'title' | 'province' | 'severity' | 'module';

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4, unassessed: 5 };

export function IncidentListView() {
  const navigate = useNavigate();
  const { filtered: incidents } = useFilteredIncidents();
  const setViewMode = useAppStore((s) => s.setViewMode);
  const [sortKey, setSortKey] = useState<SortKey>('dateOccurred');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...incidents];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'dateOccurred':
          cmp = (a.dateOccurred || '').localeCompare(b.dateOccurred || '');
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'province':
          cmp = a.province.localeCompare(b.province);
          break;
        case 'severity':
          cmp = (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5);
          break;
        case 'module':
          cmp = a.module.localeCompare(b.module);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [incidents, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : '';

  const handleRowClick = (inc: MockIncident) => {
    setViewMode('map');
    navigate(`/incident/${inc.id}`);
  };

  return (
    <div className="incident-list-view">
      <table className="incident-list-table">
        <thead>
          <tr>
            <th onClick={() => toggleSort('dateOccurred')} className="sortable">
              DATE{sortIcon('dateOccurred')}
            </th>
            <th onClick={() => toggleSort('title')} className="sortable">
              INCIDENT{sortIcon('title')}
            </th>
            <th onClick={() => toggleSort('province')} className="sortable">
              LOCATION{sortIcon('province')}
            </th>
            <th onClick={() => toggleSort('module')} className="sortable">
              TYPE{sortIcon('module')}
            </th>
            <th onClick={() => toggleSort('severity')} className="sortable">
              SEVERITY{sortIcon('severity')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((inc) => {
            const modMeta = MODULE_META[inc.module as keyof typeof MODULE_META] ?? MODULE_META.ait;
            const sevMeta = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.medium;
            return (
              <tr key={inc.id} onClick={() => handleRowClick(inc)}>
                <td className="list-cell-date">{inc.dateOccurred || 'Unknown'}</td>
                <td className="list-cell-title">
                  {inc.title}
                  {(inc.casualties?.deceased ?? 0) > 0 && (
                    <span className="list-casualty deceased">{inc.casualties!.deceased} deceased</span>
                  )}
                  {(inc.casualties?.injured ?? 0) > 0 && (
                    <span className="list-casualty injured">{inc.casualties!.injured} injured</span>
                  )}
                </td>
                <td className="list-cell-location">{inc.town}{inc.town && inc.province ? ', ' : ''}{inc.province}</td>
                <td className="list-cell-type">
                  <span className="list-type-badge" style={{
                    background: `${modMeta.colour}20`,
                    color: modMeta.colour,
                    borderColor: `${modMeta.colour}40`,
                  }}>
                    {modMeta.label}
                  </span>
                </td>
                <td className="list-cell-severity">
                  <span className="list-sev-badge" style={{
                    background: `${sevMeta.colour}20`,
                    color: sevMeta.colour,
                  }}>
                    {sevMeta.label}
                  </span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="list-empty">No incidents match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
