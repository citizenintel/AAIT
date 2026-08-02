import { useState, useMemo, useCallback } from 'react';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '../../data/mock-incidents';
import { fetchIncidents, mockToRow, type IncidentRow } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAppStore } from '@/stores/app-store';

function buildSearchQuery(inc: IncidentRow): string {
  const parts: string[] = [];
  if (inc.title) parts.push(inc.title);
  if (inc.location?.town) parts.push(inc.location.town);
  if (inc.location?.province) parts.push(inc.location.province);
  if (inc.occurred_at) parts.push(inc.occurred_at);
  return parts.join(' ');
}

function SearchButtons({ incident }: { incident: IncidentRow }) {
  const query = encodeURIComponent(buildSearchQuery(incident));
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
      <a
        href={`https://news.google.com/search?q=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-mini"
        title="Search Google News"
        style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#2563eb22', color: '#3b82f6', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        News
      </a>
      <a
        href={`https://www.google.com/search?q=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-mini"
        title="Search Google"
        style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#16a34a22', color: '#22c55e', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        Web
      </a>
      <a
        href={`https://twitter.com/search?q=${query}&f=live`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-mini"
        title="Search X/Twitter"
        style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#a855f722', color: '#a855f7', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        X
      </a>
    </div>
  );
}

export function AdminIncidents() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: apiIncidents, loading } = useQuery(() => fetchIncidents(), []);
  const importedIncidents = useAppStore((s) => s.importedIncidents);

  const incidents = useMemo(() => {
    const api = apiIncidents ?? [];
    const imported = importedIncidents.map(mockToRow);
    return [...api, ...imported];
  }, [apiIncidents, importedIncidents]);

  const filtered = useMemo(() => {
    return incidents.filter(inc => {
      if (moduleFilter !== 'all' && inc.category?.module !== moduleFilter) return false;
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inc.title.toLowerCase().includes(q) && !(inc.location?.town ?? '').toLowerCase().includes(q) && !(inc.location?.province ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, moduleFilter, severityFilter, incidents]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Incidents</h1>
        <p>Manage and review all tracked incidents</p>
      </div>

      <div className="admin-toolbar">
        <input type="text" className="form-input" placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <select className="form-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All modules</option>
          {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All severities</option>
          {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="toolbar-count">{filtered.length} of {(incidents ?? []).length}</span>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Verification</th>
              <th>Location</th>
              <th>Date</th>
              <th>Sources</th>
              <th>Research</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inc => {
              const mod = MODULE_META[inc.category?.module as keyof typeof MODULE_META];
              const sev = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META];
              const ver = VERIFICATION_META[inc.verification_state];
              const isExpanded = expandedId === inc.id;
              return (
                <tr key={inc.id} onClick={() => toggleExpand(inc.id)} style={{ cursor: 'pointer' }}>
                  <td className="td-title">
                    {inc.title}
                    {isExpanded && inc.confirmed_facts && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, maxHeight: 80, overflow: 'hidden' }}>
                        {inc.confirmed_facts.slice(0, 300)}{inc.confirmed_facts.length > 300 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td><span style={{ color: mod?.colour, fontWeight: 500 }}>{mod?.label}</span></td>
                  <td><span className="table-badge" style={{ background: (sev?.colour ?? '#888') + '22', color: sev?.colour }}>{sev?.label}</span></td>
                  <td><span className="table-badge verification">{ver?.label}</span></td>
                  <td>{inc.location?.town}{inc.location?.town && inc.location?.province ? ', ' : ''}{inc.location?.province}</td>
                  <td>{inc.occurred_at}</td>
                  <td style={{ textAlign: 'center' }}>{inc.source_count}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <SearchButtons incident={inc} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
