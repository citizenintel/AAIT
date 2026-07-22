import { useState, useMemo } from 'react';
import { MOCK_INCIDENTS, MODULE_META, SEVERITY_META, VERIFICATION_META } from '../../data/mock-incidents';

export function AdminIncidents() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filtered = useMemo(() => {
    return MOCK_INCIDENTS.filter(inc => {
      if (moduleFilter !== 'all' && inc.module !== moduleFilter) return false;
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inc.title.toLowerCase().includes(q) && !inc.town.toLowerCase().includes(q) && !inc.province.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, moduleFilter, severityFilter]);

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
        <span className="toolbar-count">{filtered.length} of {MOCK_INCIDENTS.length}</span>
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
              const mod = MODULE_META[inc.module];
              const sev = SEVERITY_META[inc.severity];
              const ver = VERIFICATION_META[inc.verification];
              return (
                <tr key={inc.id}>
                  <td><code className="id-code">{inc.id}</code></td>
                  <td className="td-title">{inc.title}{inc.isSynthetic && <span className="demo-tag">DEMO</span>}</td>
                  <td><span style={{ color: mod.colour, fontWeight: 500 }}>{mod.label}</span></td>
                  <td><span className="table-badge" style={{ background: sev.colour + '22', color: sev.colour }}>{sev.label}</span></td>
                  <td><span className="table-badge verification">{ver?.label}</span></td>
                  <td>{inc.town}, {inc.province}</td>
                  <td>{inc.dateOccurred}</td>
                  <td style={{ textAlign: 'center' }}>{inc.sourceCount}</td>
                  <td style={{ textAlign: 'center' }}>{inc.isSynthetic ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
