import { useState, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import { saveAdminAds, getStoredAdminAds, saveCampaigns, createMockCampaign, type CampaignRow } from '@/lib/api/sponsors';
import {
  DURATION_LABELS,
  DURATION_PRICES,
  SIZE_PRICES,
  SLOT_LABELS,
  MOCK_SPONSOR_ADS,
  type SponsorAd,
  type AdDuration,
} from '../../data/mock-sponsors';
import {
  SLOT_REGISTRY,
  ALL_SLOT_KEYS,
  getAssets,
  saveAssets,
  getAssetsByType,
  getImageData,
  uploadAsset,
  removeAsset,
  toggleAsset,
  getStorageUsage,
  migrateFromLegacy,
  type SlotKey,
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

function SlotCard({ slotKey, ads }: { slotKey: SlotKey; ads: SponsorAd[] }) {
  const slotDef = SLOT_REGISTRY.find(s => s.key === slotKey)!;
  const slotAssignments = useAppStore(s => s.slotAssignments);
  const setSlotMode = useAppStore(s => s.setSlotMode);
  const assignment = slotAssignments[slotKey];
  const mode = assignment?.mode ?? 'auto';
  const campaign = ads.find(a => a.slot === slotKey && a.enabled);
  const status = campaign ? getStatus(campaign) : null;

  return (
    <div className="admin-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{slotDef.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{slotDef.location}</div>
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
          onChange={e => setSlotMode(slotKey, e.target.value)}
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

  const handleToggle = (id: string, enabled: boolean) => {
    toggleAsset(id, enabled);
    refresh();
  };

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Placeholder Images</h2>
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
              <div key={asset.id} style={{ border: `1px solid ${asset.enabled ? 'var(--accent)' : 'var(--border-subtle)'}`, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-elevated)', opacity: asset.enabled ? 1 : 0.5 }}>
                <div style={{ height: 40, background: '#0a0f1a', overflow: 'hidden' }}>
                  {thumb && <img src={thumb} alt={asset.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </div>
                <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{asset.label}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleToggle(asset.id, !asset.enabled)} style={{ fontSize: 9, padding: '2px 6px', background: asset.enabled ? '#38a16920' : 'var(--bg-base)', color: asset.enabled ? '#38a169' : 'var(--text-muted)', border: `1px solid ${asset.enabled ? '#38a16940' : 'var(--border-subtle)'}`, borderRadius: 3, cursor: 'pointer' }}>
                      {asset.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => handleRemove(asset.id)} style={{ fontSize: 9, padding: '2px 6px', background: 'none', border: '1px solid #c5303040', borderRadius: 3, cursor: 'pointer', color: '#c53030' }}>✕</button>
                  </div>
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
          <h2 style={{ margin: 0 }}>Infographic Fallback</h2>
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
  const [newSlot, setNewSlot] = useState<SlotKey>('slot-1');

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
              <select value={newSlot} onChange={e => setNewSlot(e.target.value as SlotKey)} style={{ flex: 1, fontSize: 12, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}>
                {ALL_SLOT_KEYS.map(k => <option key={k} value={k}>{SLOT_LABELS[k]}</option>)}
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
              <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Slot</th>
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
                    {SLOT_LABELS[ad.slot]}
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
// Main Admin Page
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
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Content Manager</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            6-slot content system — paid ads, placeholders, and infographics
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 14px', background: sponsorsEnabled ? '#38a16915' : '#c5303015', border: `1px solid ${sponsorsEnabled ? '#38a16940' : '#c5303040'}`, borderRadius: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: sponsorsEnabled ? '#38a169' : '#c53030' }}>
            Public display: {sponsorsEnabled ? 'ON' : 'OFF'}
          </span>
          <input type="checkbox" checked={sponsorsEnabled} onChange={e => setSponsorsEnabled(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
        </label>
      </div>

      {/* 4-Slot Cards */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15 }}>Slot Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {ALL_SLOT_KEYS.map(key => (
            <SlotCard key={key} slotKey={key} ads={ads} />
          ))}
        </div>
      </div>

      {/* Campaigns */}
      <CampaignsTable />

      {/* Asset Library */}
      <AssetLibrary />

      {/* Infographic Controls */}
      <InfographicControls />

      {/* Storage & Info */}
      <div className="admin-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Storage: {formatBytes(storage.used)} used ({storage.items} items)
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Max 6 content slots · Demo mode (localStorage)
          </div>
        </div>
      </div>
    </div>
  );
}
