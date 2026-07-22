import { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import {
  MOCK_SPONSOR_ADS,
  DURATION_LABELS,
  DURATION_PRICES,
  SIZE_PRICES,
  SLOT_LABELS,
  type SponsorAd,
  type AdDuration,
} from '../../data/mock-sponsors';

const SIZE_LABELS: Record<string, string> = { premium: 'Premium', banner: 'Banner', standard: 'Standard', compact: 'Compact' };
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: '#38a16922', color: '#38a169' },
  paused: { bg: '#d69e2e22', color: '#d69e2e' },
  expired: { bg: '#71809622', color: '#718096' },
};

function getStatus(ad: SponsorAd): 'active' | 'paused' | 'expired' {
  if (!ad.enabled) return 'paused';
  const now = new Date();
  if (new Date(ad.expiresAt) <= now) return 'expired';
  return 'active';
}

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hrs}h remaining`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m remaining`;
}

function calcPrice(duration: AdDuration, size: string): number {
  const base = DURATION_PRICES[duration] || 0;
  const mult = SIZE_PRICES[size] ?? 1;
  return Math.round(base * mult);
}

export function AdminSponsors() {
  const [ads, setAds] = useState(MOCK_SPONSOR_ADS);
  const [editId, setEditId] = useState<string | null>(null);
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);
  const setSponsorsEnabled = useAppStore((s) => s.setSponsorsEnabled);

  const activeCount = ads.filter((a) => a.enabled && getStatus(a) === 'active').length;
  const totalRevenue = ads.reduce((sum, a) => sum + a.paidZAR, 0);
  const totalImpressions = ads.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = ads.reduce((sum, a) => sum + a.clicks, 0);

  const toggleAd = (id: string) => {
    setAds((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const setDuration = (id: string, duration: AdDuration) => {
    setAds((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const now = new Date().toISOString();
        const ms =
          duration === '24h' ? 86400000
          : duration === '48h' ? 172800000
          : duration === '7d' ? 604800000
          : duration === '30d' ? 2592000000
          : 604800000;
        return {
          ...a,
          duration,
          startedAt: now,
          expiresAt: new Date(Date.now() + ms).toISOString(),
          paidZAR: calcPrice(duration, a.size),
        };
      })
    );
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Sponsors</h1>
        <p>Manage sponsor campaigns across 6 slots — 2 sidebar, 2 dashboard, 2 bottom banners.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{activeCount} / 6</div>
          <div className="stat-label">Active sponsors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R{totalRevenue.toLocaleString()}</div>
          <div className="stat-label">Total revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalImpressions.toLocaleString()}</div>
          <div className="stat-label">Total impressions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalClicks.toLocaleString()}</div>
          <div className="stat-label">Total clicks</div>
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Public display</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <span style={{ color: sponsorsEnabled ? '#38a169' : 'var(--text-muted)' }}>
              {sponsorsEnabled ? 'ON — ads visible on map' : 'OFF — visualizations shown instead'}
            </span>
            <span
              className={`layer-toggle module-toggle${sponsorsEnabled ? ' active' : ''}`}
              role="switch"
              aria-checked={sponsorsEnabled}
              onClick={() => setSponsorsEnabled(!sponsorsEnabled)}
              tabIndex={0}
            />
          </label>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 0 }}>
          When ON, sponsor ads appear in 6 slots (2 sidebar, 2 dashboard, 2 bottom banners). When OFF, those slots show incident data visualizations instead.
        </p>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Campaigns</h2>
          <button className="btn btn-primary" disabled={activeCount >= 6}>+ Add sponsor</button>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Sponsor</th>
              <th>Slot / Size</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Time Left</th>
              <th>Price (ZAR)</th>
              <th>Stats</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => {
              const status = getStatus(ad);
              const st = STATUS_STYLES[status]!;
              const remaining = timeRemaining(ad.expiresAt);
              const isExpired = status === 'expired';
              const isEditing = editId === ad.id;

              return (
                <tr key={ad.id} style={{ opacity: isExpired ? 0.6 : 1 }}>
                  <td className="td-title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ad.name}
                      {ad.size === 'premium' && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#c9a84c22', color: '#c9a84c', fontWeight: 700 }}>
                          PREMIUM
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 11 }}>{SLOT_LABELS[ad.slot]}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Slot {ad.slot} · {SIZE_LABELS[ad.size]}</div>
                  </td>
                  <td>
                    <span className="table-badge" style={{ background: st.bg, color: st.color }}>
                      {status}
                    </span>
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        value={ad.duration}
                        onChange={(e) => {
                          setDuration(ad.id, e.target.value as AdDuration);
                          setEditId(null);
                        }}
                        style={{ fontSize: 11, padding: '2px 4px', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
                      >
                        {Object.entries(DURATION_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v} — R{calcPrice(k as AdDuration, ad.size)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      DURATION_LABELS[ad.duration]
                    )}
                  </td>
                  <td>
                    <span style={{ color: isExpired ? '#e53e3e' : remaining.includes('h ') && !remaining.includes('d') ? '#d69e2e' : 'var(--text-secondary)', fontSize: 11 }}>
                      {remaining}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>R{ad.paidZAR.toLocaleString()}</span>
                    {ad.size === 'premium' && (
                      <span style={{ fontSize: 9, color: '#c9a84c', display: 'block' }}>×3 multiplier</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {ad.impressions.toLocaleString()} views · {ad.clicks} clicks
                    {ad.impressions > 0 && (
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>
                        {((ad.clicks / ad.impressions) * 100).toFixed(1)}% CTR
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-small" onClick={() => toggleAd(ad.id)}>
                        {ad.enabled ? 'Pause' : 'Activate'}
                      </button>
                      <button className="btn btn-small btn-secondary" onClick={() => setEditId(isEditing ? null : ad.id)}>
                        {isEditing ? 'Cancel' : 'Duration'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h2>Pricing tiers</h2>
        <table className="admin-table" style={{ maxWidth: 600 }}>
          <thead>
            <tr><th>Duration</th><th>Compact (×0.5)</th><th>Standard (×1)</th><th>Banner (×2)</th><th>Premium (×3)</th></tr>
          </thead>
          <tbody>
            {(Object.entries(DURATION_PRICES) as [AdDuration, number][])
              .filter(([k]) => k !== 'custom')
              .map(([k, base]) => (
                <tr key={k}>
                  <td>{DURATION_LABELS[k]}</td>
                  <td>R{Math.round(base * 0.5)}</td>
                  <td>R{base}</td>
                  <td style={{ color: '#ed8936', fontWeight: 600 }}>R{base * 2}</td>
                  <td style={{ color: '#c9a84c', fontWeight: 600 }}>R{base * 3}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Custom durations negotiated directly.
        </p>
      </div>

      <div className="admin-card">
        <h2>Sponsor rules</h2>
        <ul className="admin-rules">
          <li>Maximum <strong>6 active sponsors</strong> across 6 slots (enforced by database trigger)</li>
          <li><strong>4 size tiers</strong>: Premium (×3), Banner (×2), Standard (×1), Compact (×0.5)</li>
          <li><strong>6 placement zones</strong>: 2 sidebar, 2 dashboard, 2 bottom banners</li>
          <li><strong>Timed durations</strong>: 24h, 48h, 7 days, 1 month, or custom — clock starts on activation, auto-expires</li>
          <li>When a sponsor expires or is paused, the slot <strong>reverts to data visualizations</strong></li>
          <li>Each sponsor is <strong>independently pausable/disableable</strong></li>
          <li>Impressions tracked as <strong>aggregates only</strong> — no individual user tracking</li>
          <li>Sponsor conflicts checked against incident content — sponsors are never displayed alongside incidents involving their organisation</li>
        </ul>
      </div>

      <div className="admin-note">
        All sponsors shown are synthetic test data for development purposes.
      </div>
    </div>
  );
}
