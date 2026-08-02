import { useState, useMemo, useCallback, Fragment } from 'react';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '../../data/mock-incidents';
import { fetchIncidents, mockToRow, type IncidentRow } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAppStore } from '@/stores/app-store';
import { deduplicateByContent, incidentFingerprint } from '@/lib/utils/deduplicate';

function buildSearchQuery(inc: IncidentRow): string {
  const parts: string[] = [];
  if (inc.title) parts.push(inc.title);
  if (inc.location?.town) parts.push(inc.location.town);
  if (inc.location?.province) parts.push(inc.location.province);
  if (inc.occurred_at) parts.push(inc.occurred_at);
  return parts.join(' ');
}

function buildSASearchQuery(inc: IncidentRow): string {
  const parts: string[] = [];
  if (inc.title) parts.push(inc.title);
  if (inc.location?.town) parts.push(inc.location.town);
  parts.push('South Africa');
  return parts.join(' ');
}

function ResearchPanel({ incident }: { incident: IncidentRow }) {
  const q = encodeURIComponent(buildSearchQuery(incident));
  const qSA = encodeURIComponent(buildSASearchQuery(incident));

  const linkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600 as const,
    textDecoration: 'none' as const,
    border: '1px solid var(--border)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
          Search for articles & news
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <a href={`https://news.google.com/search?q=${q}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#2563eb11', color: '#3b82f6' }}>
            Google News
          </a>
          <a href={`https://www.google.com/search?q=${q}&tbm=nws`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#16a34a11', color: '#22c55e' }}>
            Google News Tab
          </a>
          <a href={`https://www.google.com/search?q=${qSA}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#16a34a11', color: '#22c55e' }}>
            Google Web
          </a>
          <a href={`https://twitter.com/search?q=${q}&f=live`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#a855f711', color: '#a855f7' }}>
            X / Twitter
          </a>
          <a href={`https://www.reddit.com/search/?q=${qSA}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#f9731611', color: '#f97316' }}>
            Reddit
          </a>
          <a href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#ef444411', color: '#ef4444' }}>
            YouTube
          </a>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
          SA News Sources
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <a href={`https://www.news24.com/search?query=${encodeURIComponent(incident.title)}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#06b6d411', color: '#06b6d4' }}>
            News24
          </a>
          <a href={`https://www.dailymaverick.co.za/?s=${encodeURIComponent(incident.title)}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#8b5cf611', color: '#8b5cf6' }}>
            Daily Maverick
          </a>
          <a href={`https://www.iol.co.za/search?query=${encodeURIComponent(incident.title)}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#0ea5e911', color: '#0ea5e9' }}>
            IOL
          </a>
          <a href={`https://www.timeslive.co.za/search?query=${encodeURIComponent(incident.title)}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#f59e0b11', color: '#f59e0b' }}>
            TimesLive
          </a>
          <a href={`https://ewn.co.za/?s=${encodeURIComponent(incident.title)}`} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: '#10b98111', color: '#10b981' }}>
            EWN
          </a>
        </div>
      </div>
    </div>
  );
}

function IncidentDetail({ incident }: { incident: IncidentRow }) {
  const mod = MODULE_META[incident.category?.module as keyof typeof MODULE_META];
  const sev = SEVERITY_META[incident.severity as keyof typeof SEVERITY_META];
  const ver = VERIFICATION_META[incident.verification_state];

  return (
    <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Left: Case details */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Case Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '4px 12px', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>ID</span>
            <code style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{incident.id}</code>
            <span style={{ color: 'var(--text-muted)' }}>Module</span>
            <span style={{ color: mod?.colour, fontWeight: 600 }}>{mod?.label ?? incident.category?.module}</span>
            <span style={{ color: 'var(--text-muted)' }}>Severity</span>
            <span style={{ color: sev?.colour, fontWeight: 600 }}>{sev?.label ?? incident.severity}</span>
            <span style={{ color: 'var(--text-muted)' }}>Verification</span>
            <span>{ver?.label ?? incident.verification_state}</span>
            <span style={{ color: 'var(--text-muted)' }}>Date</span>
            <span>{incident.occurred_at || 'Unknown'}</span>
            <span style={{ color: 'var(--text-muted)' }}>Location</span>
            <span>{[incident.location?.town, incident.location?.province].filter(Boolean).join(', ') || 'Unknown'}</span>
            <span style={{ color: 'var(--text-muted)' }}>Coordinates</span>
            <span>{incident.location?.lat && incident.location?.lng ? `${incident.location.lat.toFixed(4)}, ${incident.location.lng.toFixed(4)}` : 'N/A'}</span>
            <span style={{ color: 'var(--text-muted)' }}>Sources</span>
            <span>{incident.source_count ?? 0}</span>
            {(incident.fatality_count_confirmed ?? 0) > 0 && (<>
              <span style={{ color: 'var(--text-muted)' }}>Deceased</span>
              <span style={{ color: '#c53030', fontWeight: 700 }}>{incident.fatality_count_confirmed}</span>
            </>)}
            {(incident.injury_count_confirmed ?? 0) > 0 && (<>
              <span style={{ color: 'var(--text-muted)' }}>Injured</span>
              <span style={{ color: '#ed8936', fontWeight: 700 }}>{incident.injury_count_confirmed}</span>
            </>)}
          </div>
        </div>

        {/* Right: Research */}
        <div>
          <ResearchPanel incident={incident} />
        </div>
      </div>

      {/* Full case text */}
      {incident.confirmed_facts && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
            Full Case Notes
          </div>
          <div style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            background: 'var(--surface-0)',
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            maxHeight: 300,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}>
            {incident.confirmed_facts}
          </div>
        </div>
      )}

      {/* Tags */}
      {incident.tags && incident.tags.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Tags</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {incident.tags.map((t, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--surface-0)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {t.tag}
              </span>
            ))}
          </div>
        </div>
      )}
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
    return deduplicateByContent(
      [...api, ...imported],
      (i: IncidentRow) => incidentFingerprint(i.title, i.occurred_at ?? '', i.location?.town ?? i.location?.province ?? ''),
      (i: IncidentRow) => i.id,
    );
  }, [apiIncidents, importedIncidents]);

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

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Incidents</h1>
        <p>{filtered.length} of {incidents.length} incidents — click any row to expand full details and research links</p>
      </div>

      <div className="admin-toolbar">
        <input type="text" className="form-input" placeholder="Search title, location, or case notes..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 340 }} />
        <select className="form-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All modules</option>
          {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All severities</option>
          {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        <table className="admin-table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Title</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Location</th>
              <th>Date</th>
              <th>Casualties</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inc => {
              const mod = MODULE_META[inc.category?.module as keyof typeof MODULE_META];
              const sev = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META];
              const isExpanded = expandedId === inc.id;
              const dead = inc.fatality_count_confirmed ?? 0;
              const hurt = inc.injury_count_confirmed ?? 0;
              return (
                <Fragment key={inc.id}>
                  <tr onClick={() => toggleExpand(inc.id)} style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-elevated)' : undefined }}>
                    <td style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                      {isExpanded ? '▼' : '▶'}
                    </td>
                    <td className="td-title" style={{ fontWeight: isExpanded ? 600 : 400 }}>
                      {inc.title}
                    </td>
                    <td><span style={{ color: mod?.colour, fontWeight: 500 }}>{mod?.label}</span></td>
                    <td><span className="table-badge" style={{ background: (sev?.colour ?? '#888') + '22', color: sev?.colour }}>{sev?.label}</span></td>
                    <td style={{ fontSize: 11 }}>{inc.location?.town}{inc.location?.town && inc.location?.province ? ', ' : ''}{inc.location?.province}</td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{inc.occurred_at}</td>
                    <td style={{ textAlign: 'center', fontSize: 11 }}>
                      {dead > 0 && <span style={{ color: '#c53030', fontWeight: 700 }}>{dead}D</span>}
                      {dead > 0 && hurt > 0 && ' '}
                      {hurt > 0 && <span style={{ color: '#ed8936', fontWeight: 700 }}>{hurt}I</span>}
                      {dead === 0 && hurt === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <IncidentDetail incident={inc} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
