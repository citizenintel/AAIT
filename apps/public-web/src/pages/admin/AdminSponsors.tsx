import { useState, useMemo, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/app-store';
import { fetchSponsors, updateCampaignStatus, createMockCampaign, saveCampaigns, saveAdminAds, getStoredAdminAds, type CampaignRow } from '@/lib/api/sponsors';
import { useQuery, useMutation } from '@/lib/hooks/useQuery';
import {
  DURATION_LABELS,
  DURATION_PRICES,
  SIZE_PRICES,
  SLOT_LABELS,
  type SponsorAd,
  type AdDuration,
} from '../../data/mock-sponsors';
import {
  getConfig, saveConfig, uploadImage, removeImage, getThumbnail,
  getStorageUsage,
  type SlotImage, type SlotCategory,
} from '@/lib/services/hero-images';

const SIZE_LABELS: Record<string, string> = { premium: 'Premium', banner: 'Banner', standard: 'Standard', compact: 'Compact' };
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: '#38a16922', color: '#38a169' },
  paused: { bg: '#d69e2e22', color: '#d69e2e' },
  expired: { bg: '#8a94a622', color: '#8a94a6' },
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

function syncToFrontendDirect(adsList: SponsorAd[]) {
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
      placement: `slot-${a.slot}`,
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

function ImageGrid({ category, label, description }: { category: SlotCategory; label: string; description: string }) {
  const [images, setImages] = useState(() => getConfig(category));
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setImages(getConfig(category)), [category]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await uploadImage(file, category);
      refresh();
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleEnabled = (id: string) => {
    const updated = images.map(img => img.id === id ? { ...img, enabled: !img.enabled } : img);
    saveConfig(category, updated);
    setImages(updated);
  };

  const handleDelete = (id: string) => {
    removeImage(id, category);
    setConfirmDelete(null);
    refresh();
  };

  const moveUp = (id: string) => {
    const idx = images.findIndex(i => i.id === id);
    if (idx <= 0) return;
    const updated = [...images];
    [updated[idx - 1]!, updated[idx]!] = [updated[idx]!, updated[idx - 1]!];
    updated.forEach((img, i) => { img.order = i; });
    saveConfig(category, updated);
    setImages(updated);
  };

  const moveDown = (id: string) => {
    const idx = images.findIndex(i => i.id === id);
    if (idx < 0 || idx >= images.length - 1) return;
    const updated = [...images];
    [updated[idx]!, updated[idx + 1]!] = [updated[idx + 1]!, updated[idx]!];
    updated.forEach((img, i) => { img.order = i; });
    saveConfig(category, updated);
    setImages(updated);
  };

  const saveLabel = (id: string) => {
    const updated = images.map(img => img.id === id ? { ...img, label: editValue.trim() || img.label } : img);
    saveConfig(category, updated);
    setImages(updated);
    setEditLabel(null);
  };

  const enabledCount = images.filter(i => i.enabled).length;

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>{label}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{description}</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            {images.length} image{images.length !== 1 ? 's' : ''} &middot; {enabledCount} active
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

      {images.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>
          No images yet. Upload one to get started.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {images.map((img, idx) => {
          const thumb = getThumbnail(img);
          return (
            <div key={img.id} style={{ border: `1px solid ${img.enabled ? 'var(--accent)' : 'var(--border-subtle)'}`, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)', opacity: img.enabled ? 1 : 0.5, transition: 'opacity 0.2s, border-color 0.2s' }}>
              <div style={{ position: 'relative', height: 140, background: '#0a0f1a', overflow: 'hidden' }}>
                {thumb ? (
                  <img src={thumb} alt={img.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 11 }}>No preview</div>
                )}
                <div style={{ position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</div>
                <div style={{ position: 'absolute', top: 6, right: 6, padding: '2px 6px', borderRadius: 3, background: img.type === 'builtin' ? '#3182ce30' : '#c9a84c30', color: img.type === 'builtin' ? '#63b3ed' : '#c9a84c', fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>
                  {img.type === 'builtin' ? 'Built-in' : 'Uploaded'}
                </div>
              </div>
              <div style={{ padding: '8px 10px' }}>
                {editLabel === img.id ? (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveLabel(img.id); if (e.key === 'Escape') setEditLabel(null); }} autoFocus style={{ flex: 1, fontSize: 12, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-primary)' }} />
                    <button onClick={() => saveLabel(img.id)} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, cursor: 'pointer' }} title="Click to rename" onClick={() => { setEditLabel(img.id); setEditValue(img.label); }}>
                    {img.label}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => toggleEnabled(img.id)} style={{ flex: 1, fontSize: 10, padding: '4px 0', background: img.enabled ? '#38a16920' : 'var(--bg-base)', color: img.enabled ? '#38a169' : 'var(--text-muted)', border: `1px solid ${img.enabled ? '#38a16940' : 'var(--border-subtle)'}`, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                    {img.enabled ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => moveUp(img.id)} disabled={idx === 0} title="Move up" style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text-secondary)', fontSize: 11 }}>&#9650;</button>
                  <button onClick={() => moveDown(img.id)} disabled={idx === images.length - 1} title="Move down" style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: idx === images.length - 1 ? 'default' : 'pointer', opacity: idx === images.length - 1 ? 0.3 : 1, color: 'var(--text-secondary)', fontSize: 11 }}>&#9660;</button>
                  {img.type === 'uploaded' && (
                    confirmDelete === img.id ? (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => handleDelete(img.id)} style={{ fontSize: 10, padding: '4px 8px', background: '#c53030', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Confirm</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 10, padding: '4px 6px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(img.id)} title="Delete" style={{ padding: '4px 6px', background: 'none', border: '1px solid #c5303040', borderRadius: 4, cursor: 'pointer', color: '#c53030', fontSize: 11 }}>&#10005;</button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminSponsors() {
  const { data: sponsors, loading, error, refetch } = useQuery(fetchSponsors);
  const statusMutation = useMutation(updateCampaignStatus);

  // Flatten SponsorRow[] (with nested campaigns) into a SponsorAd-shaped list
  // so the existing table template works unchanged
  const initialAds = useMemo(() => {
    if (!sponsors) return [];
    const result: SponsorAd[] = [];
    let slotIndex = 1;
    for (const sp of sponsors) {
      for (const c of sp.campaigns ?? []) {
        result.push({
          id: c.id,
          name: c.display_name || sp.name,
          slot: (slotIndex <= 6 ? slotIndex : slotIndex % 6 + 1) as SponsorAd['slot'],
          enabled: c.status === 'active',
          size: (c.size as SponsorAd['size']) || 'standard',
          tagline: c.tagline ?? '',
          websiteUrl: c.link_url ?? sp.url ?? '',
          bgColor: '#1a1a2e',
          textColor: '#e0e0e0',
          accentColor: '#4a90d9',
          icon: 'shield',
          duration: '7d',
          startedAt: c.starts_at ?? new Date().toISOString(),
          expiresAt: c.ends_at ?? new Date().toISOString(),
          impressions: c.impressions ?? 0,
          clicks: c.clicks ?? 0,
          paidZAR: 0,
        });
        slotIndex++;
      }
    }
    return result;
  }, [sponsors]);

  const [ads, setAds] = useState<SponsorAd[]>(() => {
    const stored = getStoredAdminAds();
    return stored ?? [];
  });
  // Sync API data into local state when it arrives (only if no stored ads exist)
  if (initialAds.length > 0 && ads.length === 0) {
    setAds(initialAds);
    syncToFrontendDirect(initialAds);
  }

  const [editId, setEditId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSponsor, setNewSponsor] = useState({ name: '', tagline: '', size: 'standard' as string, websiteUrl: '', imageUrl: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);
  const setSponsorsEnabled = useAppStore((s) => s.setSponsorsEnabled);

  const activeCount = ads.filter((a) => a.enabled && getStatus(a) === 'active').length;
  const totalRevenue = ads.reduce((sum, a) => sum + a.paidZAR, 0);
  const totalImpressions = ads.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = ads.reduce((sum, a) => sum + a.clicks, 0);

  const toggleAd = async (id: string) => {
    const ad = ads.find((a) => a.id === id);
    if (!ad) return;
    const newStatus = ad.enabled ? 'paused' : 'active';
    const updated = ads.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
    setAds(updated);
    syncToFrontend(updated);
    try {
      await statusMutation.execute(id, newStatus);
    } catch {
      const reverted = ads.map((a) => (a.id === id ? { ...a, enabled: ad.enabled } : a));
      setAds(reverted);
      syncToFrontend(reverted);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNewSponsor(s => ({ ...s, imageUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const syncToFrontend = syncToFrontendDirect;

  const addSponsor = async () => {
    if (!newSponsor.name.trim()) return;
    const usedSlots = new Set(ads.map(a => a.slot));
    const freeSlot = ([1, 2, 3, 4, 5, 6] as const).find(s => !usedSlots.has(s)) ?? 1;
    try {
      const ad = await createMockCampaign(newSponsor.name.trim(), newSponsor.tagline.trim(), newSponsor.size, freeSlot, newSponsor.websiteUrl.trim(), newSponsor.imageUrl || undefined);
      const updated = [...ads, ad];
      setAds(updated);
      syncToFrontend(updated);
    } catch { /* production: DB insert */ }
    setNewSponsor({ name: '', tagline: '', size: 'standard', websiteUrl: '', imageUrl: '' });
    setShowAddForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setDuration = (id: string, duration: AdDuration) => {
    const updated = ads.map((a) => {
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
    });
    setAds(updated);
    syncToFrontend(updated);
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Ad Manager</h1>
        <p>Manage ad campaigns across 6 slots — 2 sidebar, 2 dashboard, 2 bottom banners.</p>
      </div>

      {loading && <div className="import-msg" style={{ marginBottom: 16 }}>Loading sponsors…</div>}
      {error && <div className="import-msg warning" style={{ marginBottom: 16 }}><strong>Error:</strong> {error}</div>}

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
          <button className="btn btn-primary" disabled={activeCount >= 6} onClick={() => setShowAddForm(v => !v)}>+ Add sponsor</button>
        </div>

        {showAddForm && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 2 }}>Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Sponsor name"
                  value={newSponsor.name}
                  onChange={e => setNewSponsor(s => ({ ...s, name: e.target.value }))}
                  style={{ width: 180, fontSize: 13 }}
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 2 }}>Tagline</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Short tagline"
                  value={newSponsor.tagline}
                  onChange={e => setNewSponsor(s => ({ ...s, tagline: e.target.value }))}
                  style={{ width: 200, fontSize: 13 }}
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 2 }}>Website URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com"
                  value={newSponsor.websiteUrl}
                  onChange={e => setNewSponsor(s => ({ ...s, websiteUrl: e.target.value }))}
                  style={{ width: 200, fontSize: 13 }}
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 2 }}>Size / Package</label>
                <select
                  className="form-input"
                  value={newSponsor.size}
                  onChange={e => setNewSponsor(s => ({ ...s, size: e.target.value }))}
                  style={{ width: 130, fontSize: 13 }}
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="banner">Banner</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 2 }}>Ad Image (max 5MB)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ fontSize: 12 }}
                />
              </div>
              {newSponsor.imageUrl && (
                <div style={{ position: 'relative' }}>
                  <img
                    src={newSponsor.imageUrl}
                    alt="Preview"
                    style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)' }}
                  />
                  <button
                    onClick={() => { setNewSponsor(s => ({ ...s, imageUrl: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#e53e3e', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={addSponsor} disabled={!newSponsor.name.trim()}>Create Campaign</button>
              <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setNewSponsor({ name: '', tagline: '', size: 'standard', websiteUrl: '', imageUrl: '' }); }}>Cancel</button>
            </div>
          </div>
        )}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
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
                  <td>
                    {ad.imageUrl ? (
                      <img src={ad.imageUrl} alt={ad.name} style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)' }} />
                    ) : (
                      <div style={{ width: 48, height: 32, borderRadius: 4, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text-muted)' }}>No img</div>
                    )}
                  </td>
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
                        className="form-input"
                        value={ad.duration}
                        onChange={(e) => {
                          setDuration(ad.id, e.target.value as AdDuration);
                          setEditId(null);
                        }}
                        style={{ fontSize: 11, padding: '2px 4px', width: 'auto' }}
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

      <ImageGrid
        category="ad"
        label="Paid Ad Images"
        description="Shown in empty ad slots when sponsors are ON but no paid campaign is assigned. Rotate through available slots."
      />

      <ImageGrid
        category="hero"
        label="Placeholder Images (Sponsors OFF)"
        description="Shown in ALL slots when the ad toggle is OFF. Branding images — AAIT farm scenes, command center, etc."
      />

      <div className="admin-note" style={{ marginBottom: 20 }}>
        <strong>Storage:</strong> {formatBytes(getStorageUsage().used)} used across {getStorageUsage().items} items.
        Upload JPG/PNG/SVG up to 5 MB each.
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
        <h2>Ad rules</h2>
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
        Sponsor data is loaded from the database. When Supabase is not configured, synthetic fallback data is shown.
      </div>
    </div>
  );
}
