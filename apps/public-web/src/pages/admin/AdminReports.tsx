import { useMemo, useState } from 'react';
import { MOCK_INCIDENTS, SEVERITY_META, MODULE_META, VERIFICATION_META } from '../../data/mock-incidents';

const PROVINCES = ['All provinces', ...Array.from(new Set(MOCK_INCIDENTS.map((i) => i.province))).sort()];

export function AdminReports() {
  const [province, setProvince] = useState('All provinces');
  const [includeSynthetic, setIncludeSynthetic] = useState(true);

  const rows = useMemo(() => {
    return MOCK_INCIDENTS
      .filter((i) => province === 'All provinces' || i.province === province)
      .filter((i) => includeSynthetic || !i.isSynthetic)
      .sort((a, b) => (a.dateOccurred < b.dateOccurred ? 1 : -1));
  }, [province, includeSynthetic]);

  const stats = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    let deceased = 0, injured = 0;
    for (const i of rows) {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
      byModule[i.module] = (byModule[i.module] ?? 0) + 1;
      deceased += i.casualties?.deceased ?? 0;
      injured += i.casualties?.injured ?? 0;
    }
    return { bySeverity, byModule, deceased, injured };
  }, [rows]);

  const generatedAt = new Date().toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' });

  return (
    <div className="admin-page">
      <div className="admin-page-header no-print">
        <h1>Reports</h1>
        <p>Generate a formatted incident report. Print it, or use your browser's print dialog to save as PDF.</p>
      </div>

      <div className="admin-card no-print">
        <div className="report-controls">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Province</label>
            <select className="form-input" value={province} onChange={(e) => setProvince(e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <label className="toggle-switch" style={{ alignSelf: 'flex-end', marginBottom: 6 }}>
            <input type="checkbox" checked={includeSynthetic} onChange={(e) => setIncludeSynthetic(e.target.checked)} />
            <span className="toggle-slider" />
            <span className="toggle-label">Include synthetic test data</span>
          </label>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => window.print()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: '-2px' }}>
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
            </svg>
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* The printable document */}
      <div className="report-document">
        <div className="report-doc-header">
          <div>
            <div className="report-doc-brand">Alt Afrikaner Incident Tracker</div>
            <h2 className="report-doc-title">Incident Report</h2>
          </div>
          <div className="report-doc-meta">
            <div>Generated: {generatedAt}</div>
            <div>Scope: {province}</div>
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
                <th>Date</th><th>Module</th><th>Severity</th><th>Location</th><th>Province</th><th>Verification</th><th>Cas.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>{i.dateOccurred}</td>
                  <td>{MODULE_META[i.module]?.label ?? i.module}</td>
                  <td style={{ textTransform: 'capitalize' }}>{SEVERITY_META[i.severity]?.label ?? i.severity}</td>
                  <td>{i.town}</td>
                  <td>{i.province}</td>
                  <td>{VERIFICATION_META[i.verification]?.label ?? i.verification}</td>
                  <td>{(i.casualties?.deceased ?? 0)}D / {(i.casualties?.injured ?? 0)}I</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-doc-footer">
          Alt Afrikaner Incident Tracker · Mapped. Sourced. Reviewed. · This report contains synthetic test data unless stated otherwise. Not for distribution.
        </div>
      </div>
    </div>
  );
}
