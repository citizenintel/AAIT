import { useState, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import { saveAdminAds, getStoredAdminAds, saveCampaigns, createMockCampaign, type CampaignRow } from '@/lib/api/sponsors';
import {
  DURATION_LABELS,
  DURATION_PRICES,
  SIZE_PRICES,
  PLACEMENT_LABELS,
  MOCK_SPONSOR_ADS,
  type SponsorAd,
  type AdDuration,
} from '../../data/mock-sponsors';
import {
  PLACEMENT_REGISTRY,
  ALL_PLACEMENT_IDS,
  getAssets,
  saveAssets,
  getAssetsByType,
  getImageData,
  uploadAsset,
  removeAsset,
  getStorageUsage,
  migrateFromLegacy,
  seedTestData,
  clearTestData,
  isTestDataSeeded,
  type PlacementId,
  type ContentAsset,
} from '@/lib/content-slots';
import { INFOGRAPHIC_LABELS } from '@/components/widgets/ManagedContentSlot';

const SIZE_LABELS: Record<string, string> = { premium: 'Premium', standard: 'Standard', compact: 'Compact' };
const MODE_LABELS: Record<string, string> = { auto: 'Auto', paid_ad: 'Paid Ad', infographic: 'Infographic', placeholder: 'Placeholder', hidden: 'Hidden' };
const MODE_OPTIONS = ['auto', 'paid_ad', 'infographic', 'placeholder', 'hidden'] as const;

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: '#38a16922', color: '#38a169' },
  paused: { bg: '#d69e2e22', color: '#d69e2e' },
  expired: { bg: '#8a94a622', color: '#8a94a6' },
};

function getStatus(ad: SponsorAd): 'active' | 'paused' | 'expired' {
  if (!ad.enabled) return 'paused';
  if (new Date(ad.expiresAt) <= new Date()) return 'expired';
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

function syncToFrontend(adsList: SponsorAd[]) {
  saveAdminAds(adsList);
  const now = Date.now();
  const campaigns: CampaignRow[] = adsList.map(a => {
    const expired = new Date(a.expiresAt).getTime() <= now;
    const status = !a.enabled ? 'paused' : expired ? 'expired' : 'active';
    return {
      id: a.id,
      sponsor_id: a.id,
      name: a.name,
      size: a.size,
      placement: a.slot,
      status,
      starts_at: a.startedAt,
      ends_at: a.expiresAt,
      display_name: a.name,
      tagline: a.tagline,
      link_url: a.websiteUrl,
      logo_path: null,
      image_url: a.imageUrl,
      impressions: a.impressions,
      clicks: a.clicks,
    };
  });
  saveCampaigns(campaigns);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Slot Card Component
// ---------------------------------------------------------------------------

function SlotCard({ placementId, ads }: { placementId: PlacementId; ads: SponsorAd[] }) {
  const placementDef = PLACEMENT_REGISTRY.find(p => p.id === placementId)!;
  const slotAssignments = useAppStore(s => s.slotAssignments);
  const setSlotMode = useAppStore(s => s.setSlotMode);
  const assignment = slotAssignments[placementId];
  const mode = assignment?.mode ?? 'auto';
  const campaign = ads.find(a => a.slot === placementId && a.enabled);
  const status = campaign ? getStatus(campaign) : null;

  return (
    <div className="admin-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{placementDef.publicLabel}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{placementDef.referenceWidth}×{placementDef.referenceHeight}</div>
        </div>
        {status && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: STATUS_STYLES[status]?.bg, color: STATUS_STYLES[status]?.color, textTransform: 'uppercase' }}>
            {status}
          </span>
        )}
      </div>

      {campaign && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, padding: '6px 8px', background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
          <strong>{campaign.name}</strong> — {campaign.tagline}
          {status === 'active' && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>{timeRemaining(campaign.expiresAt)}</div>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Mode:</label>
        <select
          value={mode}
          onChange={e => setSlotMode(placementId, e.target.value)}
          style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          {MODE_OPTIONS.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset Library Component
// ---------------------------------------------------------------------------

function AssetLibrary() {
  const [assets, setAssets] = useState(() => { migrateFromLegacy(); return getAssetsByType('placeholder'); });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setAssets(getAssetsByType('placeholder')), []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await uploadAsset(file, 'placeholder');
      refresh();
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = (id: string) => {
    removeAsset(id);
    refresh();
  };

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Creative Library</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Uploaded images shown in slots when no paid campaign is active.
          </p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ fontSize: 12, padding: '6px 14px' }}>
            {uploading ? 'Uploading...' : '+ Upload image'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#c5303015', border: '1px solid #c5303040', borderRadius: 6, color: '#c53030', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {assets.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>
          No placeholder images. Upload one to get started.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {assets.map(asset => {
            const thumb = getImageData(asset.id);
            return (
              <div key={asset.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                <div style={{ height: 40, background: '#0a0f1a', overflow: 'hidden' }}>
                  {thumb && <img src={thumb} alt={asset.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </div>
                <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{asset.label}</span>
                  <button onClick={() => handleRemove(asset.id)} style={{ fontSize: 9, padding: '2px 6px', background: 'none', border: '1px solid #c5303040', borderRadius: 3, cursor: 'pointer', color: '#c53030' }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Infographic Controls
// ---------------------------------------------------------------------------

function InfographicControls() {
  const globalFallback = useAppStore(s => s.globalInfographicFallback);
  const setGlobalFallback = useAppStore(s => s.setGlobalInfographicFallback);
  const types = useAppStore(s => s.enabledInfographicTypes);
  const setTypes = useAppStore(s => s.setEnabledInfographicTypes);

  const toggleType = (type: string) => {
    if (types.includes(type)) {
      setTypes(types.filter(t => t !== type));
    } else {
      setTypes([...types, type]);
    }
  };

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Platform Fallback Content</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            When enabled, empty slots show data visualisations instead of hiding.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 11, color: globalFallback ? '#38a169' : 'var(--text-muted)', fontWeight: 600 }}>
            {globalFallback ? 'ON' : 'OFF'}
          </span>
          <input type="checkbox" checked={globalFallback} onChange={e => setGlobalFallback(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
        </label>
      </div>

      {globalFallback && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {Object.entries(INFOGRAPHIC_LABELS).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', background: types.includes(key) ? '#c9a84c10' : 'transparent', borderRadius: 4, border: `1px solid ${types.includes(key) ? '#c9a84c40' : 'var(--border-subtle)'}` }}>
              <input type="checkbox" checked={types.includes(key)} onChange={() => toggleType(key)} style={{ width: 13, height: 13 }} />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns Table
// ---------------------------------------------------------------------------

function CampaignsTable() {
  const [ads, setAds] = useState<SponsorAd[]>(() => {
    const stored = getStoredAdminAds();
    if (stored) return stored;
    return [...MOCK_SPONSOR_ADS];
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSize, setNewSize] = useState<string>('standard');
  const [newSlot, setNewSlot] = useState<PlacementId>('GLANCE_RAIL_FEATURED');

  const updateAds = useCallback((updated: SponsorAd[]) => {
    setAds(updated);
    syncToFrontend(updated);
  }, []);

  const toggleAd = (id: string) => {
    const updated = ads.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    updateAds(updated);
  };

  const setDuration = (id: string, duration: AdDuration) => {
    const now = new Date().toISOString();
    const ms: Record<string, number> = { '24h': 86400000, '48h': 172800000, '7d': 604800000, '30d': 2592000000 };
    const updated = ads.map(a => {
      if (a.id !== id) return a;
      return { ...a, duration, startedAt: now, expiresAt: new Date(Date.now() + (ms[duration] ?? 604800000)).toISOString(), paidZAR: calcPrice(duration, a.size) };
    });
    updateAds(updated);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const ad = await createMockCampaign(newName, newTagline, newSize, newSlot, newUrl);
    const updated = [...ads, ad];
    updateAds(updated);
    setShowAddForm(false);
    setNewName('');
    setNewTagline('');
    setNewUrl('');
  };

  const removeAd = (id: string) => {
    updateAds(ads.filter(a => a.id !== id));
  };

  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const totalRevenue = ads.reduce((s, a) => s + a.paidZAR, 0);
  const activeCount = ads.filter(a => getStatus(a) === 'active').length;

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Campaigns</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {activeCount}/{ads.length} active · R{totalRevenue.toLocaleString()} revenue · {totalImpressions.toLocaleString()} impressions · {totalClicks.toLocaleString()} clicks
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)} style={{ fontSize: 12, padding: '6px 14px' }}>
          {showAddForm ? 'Cancel' : '+ Add sponsor'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input placeholder="Sponsor name" value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
            <input placeholder="Tagline" value={newTagline} onChange={e => setNewTagline(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
            <input placeholder="Website URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={newSize} onChange={e => setNewSize(e.target.value)} style={{ flex: 1, fontSize: 12, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}>
                {Object.entries(SIZE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={newSlot} onChange={e => setNewSlot(e.target.value as PlacementId)} style={{ flex: 1, fontSize: 12, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}>
                {ALL_PLACEMENT_IDS.map(k => <option key={k} value={k}>{PLACEMENT_LABELS[k]}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleAdd} className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Create campaign</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Sponsor</th>
              <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Placement</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Status</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Duration</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Price</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Stats</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map(ad => {
              const status = getStatus(ad);
              const style = STATUS_STYLES[status]!;
              return (
                <tr key={ad.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ad.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{ad.tagline}</div>
                  </td>
                  <td style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>
                    {PLACEMENT_LABELS[ad.slot]}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: style.bg, color: style.color, textTransform: 'uppercase' }}>
                      {status}
                    </span>
                    {status === 'active' && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{timeRemaining(ad.expiresAt)}</div>}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <select value={ad.duration} onChange={e => setDuration(ad.id, e.target.value as AdDuration)} style={{ fontSize: 10, padding: '2px 4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-primary)' }}>
                      {Object.entries(DURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                    R{ad.paidZAR.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ad.impressions.toLocaleString()} imp</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ad.clicks} clicks ({ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0'}%)</div>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => toggleAd(ad.id)} style={{ fontSize: 9, padding: '3px 8px', background: ad.enabled ? '#d69e2e20' : '#38a16920', color: ad.enabled ? '#d69e2e' : '#38a169', border: `1px solid ${ad.enabled ? '#d69e2e40' : '#38a16940'}`, borderRadius: 3, cursor: 'pointer', fontWeight: 600 }}>
                        {ad.enabled ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={() => removeAd(ad.id)} style={{ fontSize: 9, padding: '3px 6px', background: 'none', border: '1px solid #c5303040', borderRadius: 3, cursor: 'pointer', color: '#c53030' }}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placement Map Wireframe — §12
// ---------------------------------------------------------------------------

function PlacementMap({ ads }: { ads: SponsorAd[] }) {
  const slotAssignments = useAppStore(s => s.slotAssignments);

  function slotStatus(id: PlacementId): 'active' | 'empty' | 'hidden' {
    const assignment = slotAssignments[id];
    if (assignment?.mode === 'hidden') return 'hidden';
    const campaign = ads.find(a => a.slot === id && a.enabled);
    if (campaign && getStatus(campaign) === 'active') return 'active';
    return 'empty';
  }

  const statusColor = (id: PlacementId) => {
    const s = slotStatus(id);
    if (s === 'active') return '#38a169';
    if (s === 'hidden') return '#636366';
    return '#d69e2e';
  };

  const statusBg = (id: PlacementId) => {
    const s = slotStatus(id);
    if (s === 'active') return '#38a16918';
    if (s === 'hidden') return '#63636618';
    return '#d69e2e18';
  };

  const slotBox = (id: PlacementId, label: string) => (
    <div style={{ padding: '6px 10px', border: `2px solid ${statusColor(id)}`, borderRadius: 4, background: statusBg(id), fontSize: 9, fontWeight: 700, color: statusColor(id), textAlign: 'center', whiteSpace: 'nowrap' }}>
      {label}
      <div style={{ fontSize: 7, fontWeight: 400, opacity: 0.8, marginTop: 2, textTransform: 'uppercase' }}>{slotStatus(id)}</div>
    </div>
  );

  return (
    <div className="admin-card" style={{ marginBottom: 24, padding: 20 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 14 }}>Placement Map</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 140px', gridTemplateRows: '1fr 60px', gap: 8, height: 220, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', padding: 12 }}>
        {/* Left rail */}
        <div style={{ gridRow: '1 / 3', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, border: '1px dashed var(--border)', borderRadius: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>GLANCE / LEFT RAIL</div>
          {slotBox('GLANCE_RAIL_FEATURED', 'Featured')}
          <div style={{ flex: 1 }} />
          {slotBox('LEFT_RAIL_COMPACT', 'Compact')}
        </div>
        {/* Map area */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 11 }}>
          MAP AREA
        </div>
        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px dashed var(--border)', borderRadius: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>RIGHT DASHBOARD</div>
          <div style={{ flex: 1 }} />
          {slotBox('RIGHT_DASHBOARD_RECTANGLE', 'Sponsor')}
        </div>
        {/* Bottom bar */}
        <div style={{ gridColumn: '2 / 4', display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px dashed var(--border)', borderRadius: 4 }}>
          {slotBox('BOTTOM_INTELLIGENCE_LEADERBOARD', 'Leaderboard')}
          <div style={{ flex: 1, height: 16, background: 'var(--border-subtle)', borderRadius: 3 }} />
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>News Feed</div>
          <div style={{ flex: 1, height: 16, background: 'var(--border-subtle)', borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Capacity Indicator — §15
// ---------------------------------------------------------------------------

function CapacityIndicator({ ads }: { ads: SponsorAd[] }) {
  const occupiedCount = ALL_PLACEMENT_IDS.filter(id => {
    const campaign = ads.find(a => a.slot === id && a.enabled);
    return campaign && getStatus(campaign) === 'active';
  }).length;
  const activeCampaigns = ads.filter(a => a.enabled && getStatus(a) === 'active').length;
  const scheduledCampaigns = ads.filter(a => a.enabled && getStatus(a) === 'scheduled').length;
  const creativesInLibrary = getAssetsByType('placeholder').length;

  const counters = [
    { label: 'Occupied', value: occupiedCount, max: 4, color: occupiedCount === 4 ? '#38a169' : '#4299e1' },
    { label: 'Active', value: activeCampaigns, color: '#38a169' },
    { label: 'Scheduled', value: scheduledCampaigns, color: '#d69e2e' },
    { label: 'Creatives', value: creativesInLibrary, color: '#9f7aea' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
      {counters.map(c => (
        <div key={c.label} style={{ textAlign: 'center', minWidth: 48 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.color }}>
            {c.max ? `${c.value}/${c.max}` : c.value}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
        </div>
      ))}
      {occupiedCount === 4 && <span style={{ fontSize: 9, padding: '2px 6px', background: '#38a16920', color: '#38a169', borderRadius: 3, fontWeight: 700 }}>FULL</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test Mode Controls
// ---------------------------------------------------------------------------

function TestModeControls() {
  const [seeded, setSeeded] = useState(() => isTestDataSeeded());

  const handleSeed = () => {
    seedTestData();
    setSeeded(true);
    window.location.reload();
  };

  const handleClear = () => {
    clearTestData();
    setSeeded(false);
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#d69e2e15', border: '1px solid #d69e2e40', borderRadius: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#d69e2e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Test Mode</span>
      {seeded ? (
        <button onClick={handleClear} style={{ fontSize: 11, padding: '4px 10px', background: '#c5303018', border: '1px solid #c5303040', borderRadius: 4, color: '#c53030', cursor: 'pointer', fontWeight: 600 }}>
          Clear test data
        </button>
      ) : (
        <button onClick={handleSeed} style={{ fontSize: 11, padding: '4px 10px', background: '#38a16918', border: '1px solid #38a16940', borderRadius: 4, color: '#38a169', cursor: 'pointer', fontWeight: 600 }}>
          Seed 4 test creatives
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Page — §12: "SPONSOR & PLACEMENT MANAGER"
// ---------------------------------------------------------------------------

export function AdminSponsors() {
  const sponsorsEnabled = useAppStore(s => s.sponsorsEnabled);
  const setSponsorsEnabled = useAppStore(s => s.setSponsorsEnabled);
  const storage = useMemo(() => getStorageUsage(), []);

  const ads = useMemo(() => {
    const stored = getStoredAdminAds();
    return stored ?? [...MOCK_SPONSOR_ADS];
  }, []);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Sponsor & Placement Manager</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            4 placements · Paid sponsors, platform fallback, and creative library
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <CapacityIndicator ads={ads} />
          <TestModeControls />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 14px', background: sponsorsEnabled ? '#38a16915' : '#c5303015', border: `1px solid ${sponsorsEnabled ? '#38a16940' : '#c5303040'}`, borderRadius: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: sponsorsEnabled ? '#38a169' : '#c53030' }}>
              Public sponsorship: {sponsorsEnabled ? 'ON' : 'OFF'}
            </span>
            <input type="checkbox" checked={sponsorsEnabled} onChange={e => setSponsorsEnabled(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </label>
        </div>
      </div>

      {/* Placement Map + Slot Cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <PlacementMap ads={ads} />
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 14 }}>Placement Controls</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ALL_PLACEMENT_IDS.map(id => (
              <SlotCard key={id} placementId={id} ads={ads} />
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns */}
      <CampaignsTable />

      {/* Asset Library + Infographic side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <AssetLibrary />
        <InfographicControls />
      </div>

      {/* Storage & Info */}
      <div className="admin-card" style={{ padding: 16, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Storage: {formatBytes(storage.used)} used ({storage.items} items)
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Max 4 placements · Demo mode (localStorage)
          </div>
        </div>
      </div>
    </div>
  );
}
