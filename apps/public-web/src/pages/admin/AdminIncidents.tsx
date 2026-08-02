import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULE_META, SEVERITY_META, type MockIncident } from '../../data/mock-incidents';
import { fetchIncidents, mockToRow, type IncidentRow } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAppStore } from '@/stores/app-store';
import { deduplicateByContent, incidentFingerprint } from '@/lib/utils/deduplicate';
import { calculateCredibility } from '@/lib/utils/credibility';

function AddIncidentForm({ onAdd, onCancel }: { onAdd: (inc: MockIncident) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [victimName, setVictimName] = useState('');
  const [dateOccurred, setDateOccurred] = useState('');
  const [town, setTown] = useState('');
  const [province, setProvince] = useState('');
  const [module, setModule] = useState('ait');
  const [severity, setSeverity] = useState('high');
  const [summary, setSummary] = useState('');

  const provinces = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

  const handleAdd = () => {
    const finalTitle = title.trim() || (victimName ? `${victimName} — ${town || province || 'Unknown'}` : 'Untitled incident');
    const inc: MockIncident = {
      id: `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: finalTitle,
      summary: summary.trim(),
      module: module as MockIncident['module'],
      category: module,
      severity: severity as MockIncident['severity'],
      verification: 'v0_unverified' as MockIncident['verification'],
      locationTier: 'l3_area' as MockIncident['locationTier'],
      lng: 0, lat: 0,
      province, town,
      dateOccurred: dateOccurred || new Date().toISOString().slice(0, 10),
      dateReported: new Date().toISOString().slice(0, 10),
      sourceCount: 0, sources: [], tags: [],
      isSynthetic: false,
      victimName: victimName || undefined,
    };
    onAdd(inc);
  };

  return (
    <div className="admin-card" style={{ borderLeft: '3px solid #3b82f6' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add New Incident</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Victim name</label>
          <input className="form-input" value={victimName} onChange={e => setVictimName(e.target.value)} placeholder="Full name" style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Title (auto-generated if blank)</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Incident title" style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Date occurred</label>
          <input className="form-input" type="date" value={dateOccurred} onChange={e => setDateOccurred(e.target.value)} style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Location / town</label>
          <input className="form-input" value={town} onChange={e => setTown(e.target.value)} placeholder="Town name" style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Province</label>
          <select className="form-input" value={province} onChange={e => setProvince(e.target.value)} style={{ fontSize: 12, marginTop: 2 }}>
            <option value="">-- Select --</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Module</label>
          <select className="form-input" value={module} onChange={e => setModule(e.target.value)} style={{ fontSize: 12, marginTop: 2 }}>
            {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Severity</label>
          <select className="form-input" value={severity} onChange={e => setSeverity(e.target.value)} style={{ fontSize: 12, marginTop: 2 }}>
            {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Summary / notes</label>
          <textarea className="form-input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Case description..." rows={2} style={{ fontSize: 12, marginTop: 2, resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>
        <button className="btn btn-primary" onClick={handleAdd} style={{ fontSize: 12 }}>Add incident</button>
      </div>
    </div>
  );
}

export function AdminIncidents() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const { data: apiIncidents, loading } = useQuery(() => fetchIncidents(), []);
  const importedIncidents = useAppStore((s) => s.importedIncidents);
  const addImportedIncidents = useAppStore((s) => s.addImportedIncidents);

  const incidents = useMemo(() => {
    const api = apiIncidents ?? [];
    const imported = importedIncidents.map(mockToRow);
    return deduplicateByContent(
      [...api, ...imported],
      (i: IncidentRow) => incidentFingerprint(i.title, i.occurred_at ?? '', i.location?.town ?? i.location?.province ?? ''),
      (i: IncidentRow) => i.id,
    );
  }, [apiIncidents, importedIncidents]);

  const credibilityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const imp of importedIncidents) {
      map.set(imp.id, calculateCredibility(imp).score);
    }
    return map;
  }, [importedIncidents]);

  const filtered = useMemo(() => {
    return incidents.filter(inc => {
      if (moduleFilter !== 'all' && inc.category?.module !== moduleFilter) return false;
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !inc.title.toLowerCase().includes(q) &&
          !(inc.location?.town ?? '').toLowerCase().includes(q) &&
          !(inc.location?.province ?? '').toLowerCase().includes(q) &&
          !(inc.confirmed_facts ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [search, moduleFilter, severityFilter, incidents]);

  const handleAddIncident = useCallback((inc: MockIncident) => {
    addImportedIncidents([inc]);
    setShowAdd(false);
    navigate(`/admin/incidents/${inc.id}`);
  }, [addImportedIncidents, navigate]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Incidents</h1>
            <p>Manage and review all tracked incidents</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 12 }}>
            + Add Incident
          </button>
        </div>
      </div>

      {showAdd && <AddIncidentForm onAdd={handleAddIncident} onCancel={() => setShowAdd(false)} />}

      <div className="admin-toolbar">
        <input type="text" className="form-input" placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 340 }} />
        <select className="form-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All modules</option>
          {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All severities</option>
          {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} of {incidents.length}</span>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        <table className="admin-table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Verification</th>
              <th>Location</th>
              <th>Date</th>
              <th>Casualties</th>
              <th>Credibility</th>
              <th style={{ width: 70 }}>Research</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inc => {
              const mod = MODULE_META[inc.category?.module as keyof typeof MODULE_META];
              const sev = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META];
              const dead = inc.fatality_count_confirmed ?? 0;
              const hurt = inc.injury_count_confirmed ?? 0;
              const cred = credibilityMap.get(inc.id);
              const credColour = cred !== undefined ? (cred >= 60 ? '#48bb78' : cred >= 30 ? '#ecc94b' : '#a0aec0') : undefined;
              const q = encodeURIComponent([inc.title, inc.location?.town, inc.location?.province].filter(Boolean).join(' '));

              return (
                <tr key={inc.id} onClick={() => navigate(`/admin/incidents/${inc.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="td-title" style={{ fontWeight: 500 }}>{inc.title}</td>
                  <td><span style={{ color: mod?.colour, fontWeight: 500, fontSize: 11 }}>{mod?.label}</span></td>
                  <td><span className="table-badge" style={{ background: (sev?.colour ?? '#888') + '22', color: sev?.colour }}>{sev?.label}</span></td>
                  <td style={{ fontSize: 11 }}>{inc.verification_state?.replace(/^v\d_/, '').replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: 11 }}>{inc.location?.town}{inc.location?.town && inc.location?.province ? ', ' : ''}{inc.location?.province}</td>
                  <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{inc.occurred_at}</td>
                  <td style={{ textAlign: 'center', fontSize: 11 }}>
                    {dead > 0 && <span style={{ color: '#c53030', fontWeight: 700 }}>{dead}D</span>}
                    {dead > 0 && hurt > 0 && ' '}
                    {hurt > 0 && <span style={{ color: '#ed8936', fontWeight: 700 }}>{hurt}I</span>}
                    {dead === 0 && hurt === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {cred !== undefined ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: credColour }}>{cred}%</span>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <a href={`https://news.google.com/search?q=${q}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#2563eb11', color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
                      News
                    </a>
                    {' '}
                    <a href={`https://www.google.com/search?q=${q}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#16a34a11', color: '#22c55e', textDecoration: 'none', fontWeight: 600 }}>
                      Web
                    </a>
                    {' '}
                    <a href={`https://twitter.com/search?q=${q}&f=live`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#a855f711', color: '#a855f7', textDecoration: 'none', fontWeight: 600 }}>
                      X
                    </a>
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
