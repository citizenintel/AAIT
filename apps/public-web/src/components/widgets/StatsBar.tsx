import { useMemo } from 'react';
import { useIncidentData } from '../../lib/hooks/useIncidentData';

export function StatsBar() {
  const { incidents } = useIncidentData();
  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter(i => i.severity === 'critical').length;
    const deceased = incidents.reduce((s, i) => s + (i.casualties?.deceased ?? 0), 0);
    const injured = incidents.reduce((s, i) => s + (i.casualties?.injured ?? 0), 0);
    const provinces = new Set(incidents.map(i => i.province)).size;
    const verified = incidents.filter(i =>
      i.verification === 'v3_corroborated' || i.verification === 'v4_primary_source_confirmed' || i.verification === 'v5_editorially_verified'
    ).length;
    return { total, critical, deceased, injured, provinces, verified };
  }, [incidents]);

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
