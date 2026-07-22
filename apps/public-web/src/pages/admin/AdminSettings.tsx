import { useState } from 'react';

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  category: string;
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { key: 'map_provider', label: 'Map provider', description: 'Switch between MapLibre (free) and Google Maps (paid)', enabled: true, category: 'Map' },
  { key: 'satellite', label: 'Satellite imagery', description: 'ESRI World Imagery satellite view', enabled: true, category: 'Map' },
  { key: '3d_terrain', label: '3D terrain', description: 'Elevated terrain rendering (requires compatible provider)', enabled: false, category: 'Map' },
  { key: 'geocoding', label: 'Geocoding', description: 'Address-to-coordinate lookup', enabled: false, category: 'Map' },
  { key: 'email_notifications', label: 'Email notifications', description: 'Send email alerts for critical incidents', enabled: false, category: 'Notifications' },
  { key: 'push_notifications', label: 'Push notifications', description: 'Browser push for subscribed users', enabled: false, category: 'Notifications' },
  { key: 'malware_scanning', label: 'Malware scanning', description: 'Scan uploaded evidence files', enabled: false, category: 'Security' },
  { key: 'ai_assistance', label: 'AI assistance', description: 'AI-assisted categorisation (output never auto-publishes)', enabled: false, category: 'AI' },
  { key: 'translation', label: 'Translation', description: 'Auto-translate incident summaries EN↔AF', enabled: false, category: 'AI' },
  { key: 'sponsorship', label: 'Sponsorship', description: 'Display sponsor campaigns', enabled: true, category: 'Revenue' },
  { key: 'news_ingestion', label: 'News ingestion', description: 'Automated news source monitoring', enabled: false, category: 'Ingestion' },
  { key: 'bulk_import', label: 'Bulk import', description: 'CSV/JSON bulk incident import', enabled: false, category: 'Ingestion' },
  { key: 'data_export', label: 'Data export', description: 'Export incident data as CSV/JSON', enabled: true, category: 'Data' },
  { key: 'analytics', label: 'Analytics', description: 'Aggregate analytics dashboard', enabled: true, category: 'Data' },
];

export function AdminSettings() {
  const [flags, setFlags] = useState(INITIAL_FLAGS);

  const toggleFlag = (key: string) => {
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  const categories = [...new Set(flags.map(f => f.category))];

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
            <tr><td>Taxonomy</td><td>1.0</td><td>AAIT, Unrest Watch, National Monitor, Infrastructure, Natural Events</td></tr>
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
