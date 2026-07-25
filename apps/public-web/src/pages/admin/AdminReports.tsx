import { useMemo, useState } from 'react';
import { SEVERITY_META, MODULE_META, VERIFICATION_META } from '../../data/mock-incidents';
import { fetchIncidents } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { exportCsv, exportXls, exportDocx } from '@/lib/utils/report-export';

const ALL = 'All';

const COL_DEFS = [
  { key: 'title', label: 'Title' },
  { key: 'date', label: 'Date' },
  { key: 'module', label: 'Module' },
  { key: 'severity', label: 'Severity' },
  { key: 'location', label: 'Location' },
  { key: 'province', label: 'Province' },
  { key: 'verification', label: 'Verification' },
  { key: 'casualties', label: 'Casualties' },
  { key: 'caseRef', label: 'Case Reference' },
] as const;

type ColKey = (typeof COL_DEFS)[number]['key'];

function defaultCols(): Record<ColKey, boolean> {
  return Object.fromEntries(COL_DEFS.map((c) => [c.key, true])) as Record<ColKey, boolean>;
}

export function AdminReports() {
  const { data: incidents, loading, error } = useQuery(fetchIncidents, []);
  const { user } = useAuth();
  const modPermissions = useAppStore((s) => s.modPermissions);

  const [province, setProvince] = useState(ALL);
  const [moduleFilter, setModuleFilter] = useState(ALL);
  const [severityFilter, setSeverityFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [keyword, setKeyword] = useState('');
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(defaultCols);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const isModerator = user?.role === 'moderator';
  const isAdmin = user?.role === 'system_administrator';
  const userPerms = isModerator && user?.email ? modPermissions[user.email] : null;
  const canExport = isAdmin || (isModerator && userPerms?.exportPrint === true);

  const toggleCol = (key: ColKey) =>
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));

  const provinces = useMemo(() => {
    const all = (incidents ?? []).map((i) => i.location?.province).filter(Boolean) as string[];
    return [ALL, ...Array.from(new Set(all)).sort()];
  }, [incidents]);

  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (incidents ?? [])
      .filter((i) => province === ALL || i.location?.province === province)
      .filter((i) => moduleFilter === ALL || i.category?.module === moduleFilter)
      .filter((i) => severityFilter === ALL || i.severity === severityFilter)
      .filter((i) => !dateFrom || (i.occurred_at ?? '') >= dateFrom)
      .filter((i) => !dateTo || (i.occurred_at ?? '') <= dateTo)
      .filter((i) => {
        if (!kw) return true;
        const hay = [i.title, i.location?.town, i.location?.province, i.police_case_number]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(kw);
      })
      .filter((i) => includeSynthetic || i.is_published)
      .sort((a, b) => ((a.occurred_at ?? '') < (b.occurred_at ?? '') ? 1 : -1));
  }, [incidents, province, moduleFilter, severityFilter, dateFrom, dateTo, keyword, includeSynthetic]);

  const stats = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    let deceased = 0,
      injured = 0;
    for (const i of rows) {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
      const mod = i.category?.module ?? 'unknown';
      byModule[mod] = (byModule[mod] ?? 0) + 1;
      deceased += i.fatality_count_confirmed ?? 0;
      injured += i.injury_count_confirmed ?? 0;
    }
    return { bySeverity, byModule, deceased, injured };
  }, [rows]);

  const generatedAt = new Date().toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' });

  const scopeParts: string[] = [];
  if (province !== ALL) scopeParts.push(province);
  if (moduleFilter !== ALL)
    scopeParts.push(MODULE_META[moduleFilter as keyof typeof MODULE_META]?.label ?? moduleFilter);
  if (severityFilter !== ALL)
    scopeParts.push(SEVERITY_META[severityFilter as keyof typeof SEVERITY_META]?.label ?? severityFilter);
  if (dateFrom || dateTo) scopeParts.push([dateFrom || '...', dateTo || '...'].join(' to '));
  if (keyword) scopeParts.push(`"${keyword}"`);
  const scopeLabel = scopeParts.length ? scopeParts.join(' / ') : 'All incidents';

  const activeCols = COL_DEFS.filter(c => visibleCols[c.key]).map(c => c.key);

  const exportMeta = { moduleMeta: MODULE_META, severityMeta: SEVERITY_META, verificationMeta: VERIFICATION_META };
  const exportStats = {
    total: rows.length,
    critical: stats.bySeverity['critical'] ?? 0,
    deceased: stats.deceased,
    injured: stats.injured,
    byModule: stats.byModule,
    bySeverity: stats.bySeverity,
  };

  const handleExport = (format: 'csv' | 'xls' | 'docx') => {
    setShowExportMenu(false);
    switch (format) {
      case 'csv': return exportCsv(rows, activeCols, exportMeta, scopeLabel);
      case 'xls': return exportXls(rows, activeCols, exportMeta, exportStats, scopeLabel);
      case 'docx': return exportDocx(rows, activeCols, exportMeta, exportStats, scopeLabel);
    }
  };

  if (loading) return <div className="admin-page"><p>Loading report data...</p></div>;
  if (error) return <div className="admin-page"><p className="error-text">Error loading data: {error}</p></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header no-print">
        <h1>Reports</h1>
        <p>Generate a formatted incident report. {canExport ? 'Print, export, or save as PDF.' : 'View report data below.'}</p>
      </div>

      <div className="admin-card no-print">
        <div
          className="report-controls"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Province</label>
            <select className="form-input" value={province} onChange={(e) => setProvince(e.target.value)}>
              {provinces.map((p) => (
                <option key={p} value={p}>{p === ALL ? 'All provinces' : p}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Module</label>
            <select className="form-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value={ALL}>All modules</option>
              {Object.entries(MODULE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Severity</label>
            <select className="form-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value={ALL}>All severities</option>
              {Object.entries(SEVERITY_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">From date</label>
            <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">To date</label>
            <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Title, town, province, case #"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <span className="form-hint">Filters on title, location, case number</span>
          </div>

          <label className="toggle-switch" style={{ alignSelf: 'flex-end', marginBottom: 6 }}>
            <input type="checkbox" checked={includeSynthetic} onChange={(e) => setIncludeSynthetic(e.target.checked)} />
            <span className="toggle-slider" />
            <span className="toggle-label">Include synthetic test data</span>
          </label>

          {canExport && (
            <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: '-2px' }}>
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
                </svg>
                Print / PDF
              </button>
              <div style={{ position: 'relative' }}>
                <button className="btn btn-secondary" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: '-2px' }}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Export
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4, verticalAlign: '-1px' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, minWidth: 180,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 50, overflow: 'hidden',
                  }}>
                    <button
                      className="export-menu-item"
                      onClick={() => handleExport('csv')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ width: 32, height: 20, background: '#38a169', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>CSV</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>Comma-separated values</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plain data, opens in any spreadsheet</div>
                      </div>
                    </button>
                    <button
                      className="export-menu-item"
                      onClick={() => handleExport('xls')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ width: 32, height: 20, background: '#2b6cb0', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>XLS</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>Excel spreadsheet</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Formatted table with summary stats</div>
                      </div>
                    </button>
                    <button
                      className="export-menu-item"
                      onClick={() => handleExport('docx')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ width: 32, height: 20, background: '#5a67d8', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>DOC</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>Word document</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Full report with branding and tables</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!canExport && (
            <div style={{ alignSelf: 'flex-end', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: '-2px' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Print &amp; export is a premium feature
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <span className="form-label" style={{ display: 'block', marginBottom: 8 }}>Columns to include</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
            {COL_DEFS.map((c) => (
              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={visibleCols[c.key]} onChange={() => toggleCol(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="report-document">
        <div className="report-doc-header">
          <div>
            <div className="report-doc-brand">Intelligence Twin</div>
            <h2 className="report-doc-title">Incident Report</h2>
          </div>
          <div className="report-doc-meta">
            <div>Generated: {generatedAt}</div>
            <div>Scope: {scopeLabel}</div>
            <div>Records: {rows.length}</div>
          </div>
        </div>

        <div className="report-section">
          <h3 className="report-h3">Summary</h3>
          <div className="report-summary-grid">
            <div className="report-stat"><span className="report-stat-num">{rows.length}</span><span className="report-stat-lbl">Total incidents</span></div>
            <div className="report-stat"><span className="report-stat-num">{stats.bySeverity['critical'] ?? 0}</span><span className="report-stat-lbl">Critical</span></div>
            <div className="report-stat"><span className="report-stat-num">{stats.deceased}</span><span className="report-stat-lbl">Deceased</span></div>
            <div className="report-stat"><span className="report-stat-num">{stats.injured}</span><span className="report-stat-lbl">Injured</span></div>
          </div>

          <div className="report-breakdown">
            <div>
              <div className="report-breakdown-title">By module</div>
              {Object.entries(stats.byModule).map(([m, n]) => (
                <div key={m} className="report-breakdown-row"><span>{MODULE_META[m as keyof typeof MODULE_META]?.label ?? m}</span><span>{n}</span></div>
              ))}
            </div>
            <div>
              <div className="report-breakdown-title">By severity</div>
              {Object.entries(stats.bySeverity).map(([s, n]) => (
                <div key={s} className="report-breakdown-row"><span style={{ textTransform: 'capitalize' }}>{s}</span><span>{n}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="report-section">
          <h3 className="report-h3">Incident detail</h3>
          <table className="report-table">
            <thead>
              <tr>
                {visibleCols.title && <th>Title</th>}
                {visibleCols.date && <th>Date</th>}
                {visibleCols.module && <th>Module</th>}
                {visibleCols.severity && <th>Severity</th>}
                {visibleCols.location && <th>Location</th>}
                {visibleCols.province && <th>Province</th>}
                {visibleCols.verification && <th>Verification</th>}
                {visibleCols.casualties && <th>Cas.</th>}
                {visibleCols.caseRef && <th>Case Ref.</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  {visibleCols.title && <td>{i.title}</td>}
                  {visibleCols.date && <td>{i.occurred_at ?? ''}</td>}
                  {visibleCols.module && <td>{MODULE_META[i.category?.module as keyof typeof MODULE_META]?.label ?? i.category?.module ?? ''}</td>}
                  {visibleCols.severity && <td style={{ textTransform: 'capitalize' }}>{SEVERITY_META[i.severity as keyof typeof SEVERITY_META]?.label ?? i.severity}</td>}
                  {visibleCols.location && <td>{i.location?.town ?? ''}</td>}
                  {visibleCols.province && <td>{i.location?.province ?? ''}</td>}
                  {visibleCols.verification && <td>{VERIFICATION_META[i.verification_state as keyof typeof VERIFICATION_META]?.label ?? i.verification_state}</td>}
                  {visibleCols.casualties && <td>{(i.fatality_count_confirmed ?? 0)}D / {(i.injury_count_confirmed ?? 0)}I</td>}
                  {visibleCols.caseRef && <td>{i.police_case_number ?? ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-doc-footer">
          Intelligence Twin &middot; Mapped. Sourced. Reviewed. &middot; This report contains synthetic test data unless stated otherwise. Not for distribution.
        </div>
      </div>
    </div>
  );
}
