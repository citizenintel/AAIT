import { useState, useMemo } from 'react';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '../../data/mock-incidents';
import { fetchIncidents, mockToRow } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAppStore } from '@/stores/app-store';

export function AdminIncidents() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
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
              <th>ID</th>
              <th>Title</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Verification</th>
              <th>Location</th>
              <th>Date</th>
              <th>Sources</th>
              <th>Synthetic</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inc => {
              const mod = MODULE_META[inc.category?.module as keyof typeof MODULE_META];
              const sev = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META];
              const ver = VERIFICATION_META[inc.verification_state];
              return (
                <tr key={inc.id}>
                  <td><code className="id-code">{inc.id}</code></td>
                  <td className="td-title">{inc.title}</td>
                  <td><span style={{ color: mod?.colour, fontWeight: 500 }}>{mod?.label}</span></td>
                  <td><span className="table-badge" style={{ background: (sev?.colour ?? '#888') + '22', color: sev?.colour }}>{sev?.label}</span></td>
                  <td><span className="table-badge verification">{ver?.label}</span></td>
                  <td>{inc.location?.town}, {inc.location?.province}</td>
                  <td>{inc.occurred_at}</td>
                  <td style={{ textAlign: 'center' }}>{inc.source_count}</td>
                  <td style={{ textAlign: 'center' }}></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
