import { MOCK_INCIDENTS, MODULE_META, SEVERITY_META } from '../../data/mock-incidents';
import { useAppStore } from '@/stores/app-store';

export function AdminSynthetic() {
  const showSynthetic = useAppStore((s) => s.filters.showSynthetic);
  const setShowSynthetic = useAppStore((s) => s.setShowSynthetic);
  const syntheticCount = MOCK_INCIDENTS.filter(i => i.isSynthetic).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Synthetic Test Data</h1>
        <p>Manage synthetic incidents used for development and testing. These are clearly marked and can be filtered or removed before production.</p>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Visibility</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Toggle synthetic data on/off across the entire platform</p>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={showSynthetic} onChange={(e) => setShowSynthetic(e.target.checked)} />
            <span className="toggle-slider" />
            <span className="toggle-label">{showSynthetic ? 'Visible' : 'Hidden'}</span>
          </label>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card synthetic">
          <div className="stat-value">{syntheticCount}</div>
          <div className="stat-label">Synthetic incidents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">Real incidents</div>
        </div>
      </div>

      <div className="admin-card">
        <h2>All synthetic incidents</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Province</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_INCIDENTS.filter(i => i.isSynthetic).map(inc => (
              <tr key={inc.id}>
                <td><code className="id-code">{inc.id}</code></td>
                <td className="td-title">{inc.title}</td>
                <td><span style={{ color: MODULE_META[inc.module].colour }}>{MODULE_META[inc.module].label}</span></td>
                <td><span className="table-badge" style={{ background: SEVERITY_META[inc.severity].colour + '22', color: SEVERITY_META[inc.severity].colour }}>{SEVERITY_META[inc.severity].label}</span></td>
                <td>{inc.province}</td>
                <td>{inc.sourceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h2>How synthetic data works</h2>
        <ul className="admin-rules">
          <li>Every synthetic incident has <code>isSynthetic: true</code> — filterable in queries</li>
          <li>Synthetic markers show a "SYNTHETIC TEST DATA" warning in popups</li>
          <li>The sidebar toggle above hides/shows synthetic data across the map and all views</li>
          <li>Before production: run a migration to DELETE FROM incidents WHERE is_synthetic = true</li>
          <li>Synthetic data is never mixed with real data in analytics or exports</li>
        </ul>
      </div>
    </div>
  );
}
