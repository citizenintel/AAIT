import { MODULE_META, SEVERITY_META } from '../../data/mock-incidents';
import { fetchIncidents } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';

export function AdminDashboard() {
  const { data: incidents, loading } = useQuery(() => fetchIncidents(), []);
  const all = incidents ?? [];

  const total = all.length;
  const critical = all.filter(i => i.severity === 'critical').length;
  const verified = all.filter(i => i.verification_state?.includes('v5')).length;

  const byModule = Object.entries(MODULE_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    colour: meta.colour,
    count: all.filter(i => i.category?.module === key).length,
  }));

  const bySeverity = Object.entries(SEVERITY_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    colour: meta.colour,
    count: all.filter(i => i.severity === key).length,
  }));

  const byProvince = Object.entries(
    all.reduce<Record<string, number>>((acc, i) => {
      const prov = i.location?.province ?? 'Unknown';
      acc[prov] = (acc[prov] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Overview of all tracked incidents</p>
      </div>

      {loading && <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>Loading dashboard data…</p>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total incidents</div>
        </div>
        <div className="stat-card critical">
          <div className="stat-value">{critical}</div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{verified}</div>
          <div className="stat-label">Verified</div>
        </div>
      </div>

      <div className="admin-grid-2col">
        <div className="admin-card">
          <h2>By module</h2>
          <div className="bar-list">
            {byModule.map(m => (
              <div key={m.key} className="bar-item">
                <div className="bar-label">
                  <span className="bar-dot" style={{ background: m.colour }} />
                  {m.label}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(m.count / total) * 100}%`, background: m.colour }} />
                </div>
                <span className="bar-count">{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h2>By severity</h2>
          <div className="bar-list">
            {bySeverity.map(s => (
              <div key={s.key} className="bar-item">
                <div className="bar-label">
                  <span className="bar-dot" style={{ background: s.colour }} />
                  {s.label}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(s.count / total) * 100}%`, background: s.colour }} />
                </div>
                <span className="bar-count">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>By province</h2>
        <div className="bar-list">
          {byProvince.map(([prov, count]) => (
            <div key={prov} className="bar-item">
              <div className="bar-label" style={{ minWidth: 140 }}>{prov}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(count / total) * 100}%`, background: 'var(--accent)' }} />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <h2>Recent incidents</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Verification</th>
              <th>Province</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {all.slice(0, 10).map(inc => {
              const mod = MODULE_META[inc.category?.module as keyof typeof MODULE_META];
              const sev = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META];
              return (
              <tr key={inc.id}>
                <td className="td-title">{inc.title}</td>
                <td><span style={{ color: mod?.colour }}>{mod?.label}</span></td>
                <td><span className="table-badge" style={{ color: sev?.colour }}>{inc.severity}</span></td>
                <td>{inc.verification_state?.replace(/_/g, ' ').replace(/^v\d\s*/, '') ?? ''}</td>
                <td>{inc.location?.province}</td>
                <td>{inc.occurred_at}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
