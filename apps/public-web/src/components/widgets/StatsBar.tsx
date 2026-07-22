import { useMemo } from 'react';
import { MOCK_INCIDENTS } from '../../data/mock-incidents';

export function StatsBar() {
  const stats = useMemo(() => {
    const total = MOCK_INCIDENTS.length;
    const critical = MOCK_INCIDENTS.filter(i => i.severity === 'critical').length;
    const deceased = MOCK_INCIDENTS.reduce((s, i) => s + (i.casualties?.deceased ?? 0), 0);
    const injured = MOCK_INCIDENTS.reduce((s, i) => s + (i.casualties?.injured ?? 0), 0);
    const provinces = new Set(MOCK_INCIDENTS.map(i => i.province)).size;
    const verified = MOCK_INCIDENTS.filter(i =>
      i.verification === 'v3_corroborated' || i.verification === 'v4_primary_source_confirmed' || i.verification === 'v5_editorially_verified'
    ).length;
    return { total, critical, deceased, injured, provinces, verified };
  }, []);

  return (
    <div className="widget-stats-bar">
      <div className="widget-stat">
        <span className="widget-stat-value">{stats.total}</span>
        <span className="widget-stat-label">Incidents</span>
      </div>
      <div className="widget-stat-divider" />
      <div className="widget-stat critical">
        <span className="widget-stat-value">{stats.critical}</span>
        <span className="widget-stat-label">Critical</span>
      </div>
      <div className="widget-stat-divider" />
      <div className="widget-stat deceased">
        <span className="widget-stat-value">{stats.deceased}</span>
        <span className="widget-stat-label">Deceased</span>
      </div>
      <div className="widget-stat-divider" />
      <div className="widget-stat injured">
        <span className="widget-stat-value">{stats.injured}</span>
        <span className="widget-stat-label">Injured</span>
      </div>
      <div className="widget-stat-divider" />
      <div className="widget-stat">
        <span className="widget-stat-value">{stats.verified}</span>
        <span className="widget-stat-label">Verified</span>
      </div>
      <div className="widget-stat-divider" />
      <div className="widget-stat">
        <span className="widget-stat-value">{stats.provinces}</span>
        <span className="widget-stat-label">Provinces</span>
      </div>
    </div>
  );
}
