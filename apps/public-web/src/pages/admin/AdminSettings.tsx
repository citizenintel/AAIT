import { fetchFeatureFlags, toggleFeatureFlag } from '@/lib/api/feature-flags';
import type { FeatureFlagRow } from '@/lib/api/feature-flags';
import { useQuery } from '@/lib/hooks/useQuery';

export function AdminSettings() {
  const { data: flagRows, loading, error, refetch } = useQuery(fetchFeatureFlags, []);
  const flags = (flagRows ?? []).map((f: FeatureFlagRow) => ({
    key: f.key,
    label: f.label,
    description: f.label,
    enabled: f.is_enabled,
    category: f.category.charAt(0).toUpperCase() + f.category.slice(1),
    id: f.id,
  }));

  const toggleFlag = async (key: string) => {
    const flag = flags.find(f => f.key === key);
    if (!flag) return;
    try {
      await toggleFeatureFlag(flag.id, !flag.enabled);
      refetch();
    } catch { /* errors surfaced on next refetch */ }
  };

  const categories = [...new Set(flags.map(f => f.category))];

  if (loading) return <div className="admin-page"><p>Loading settings...</p></div>;
  if (error) return <div className="admin-page"><p className="error-text">Error loading settings: {error}</p></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Settings</h1>
        <p>Platform configuration and feature flags</p>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2>Platform info</h2>
        <div className="settings-info">
          <div className="info-row"><span>Version</span><span>0.1.0-dev</span></div>
          <div className="info-row"><span>Environment</span><span>Development (local)</span></div>
          <div className="info-row"><span>Map provider</span><span>MapLibre GL JS (free)</span></div>
          <div className="info-row"><span>Database</span><span>Supabase (not connected)</span></div>
          <div className="info-row"><span>Data mode</span><span>Synthetic mock data</span></div>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat} className="admin-card" style={{ marginBottom: 16 }}>
          <h2>{cat}</h2>
          <div className="feature-flags">
            {flags.filter(f => f.category === cat).map(flag => (
              <div key={flag.key} className="feature-flag">
                <div className="flag-info">
                  <div className="flag-label">{flag.label}</div>
                  <div className="flag-desc">{flag.description}</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={flag.enabled} onChange={() => toggleFlag(flag.key)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="admin-card">
        <h2>Methodology versions</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Domain</th><th>Version</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>Verification</td><td>1.0</td><td>V0–V5, VX, VR, VA state machine</td></tr>
            <tr><td>Bias assessment</td><td>1.0</td><td>Structured human review, no automated scoring</td></tr>
            <tr><td>Taxonomy</td><td>1.0</td><td>Farm & Rural, Unrest Watch, National Monitor, Infrastructure, Natural Events</td></tr>
            <tr><td>Source independence</td><td>1.0</td><td>Ownership-group based deduplication</td></tr>
          </tbody>
        </table>
      </div>

      <div className="admin-note">
        Feature flags are stored locally during development. In production, these are managed via the feature_flags database table.
      </div>
    </div>
  );
}
