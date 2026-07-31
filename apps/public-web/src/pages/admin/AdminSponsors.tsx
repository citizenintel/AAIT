import React, { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { saveAdminAds, getStoredAdminAds, saveCampaigns, type CampaignRow } from '@/lib/api/sponsors';
import {
  MOCK_SPONSOR_ADS,
  type SponsorAd,
} from '../../data/mock-sponsors';
import {
  PLACEMENT_REGISTRY,
  ALL_PLACEMENT_IDS,
  seedTestData,
  clearTestData,
  isTestDataSeeded,
  type PlacementId,
} from '@/lib/content-slots';

const SLOT_CHANGE_CHANNEL = 'aait-slot-change';
function notifySlotChange() {
  try { new BroadcastChannel(SLOT_CHANGE_CHANNEL).postMessage({ type: 'slot-updated', ts: Date.now() }); } catch {}
}

const SLOT_NUMBERS: Record<PlacementId, number> = {
  LEFT_RAIL_HALF_PAGE: 1,
  BOTTOM_PRIMARY_BILLBOARD: 2,
  BOTTOM_SECONDARY_BILLBOARD: 3,
  RIGHT_RAIL_HALF_PAGE: 4,
};

const SLOT_SHORT_LABELS: Record<PlacementId, string> = {
  LEFT_RAIL_HALF_PAGE: 'Left Rail',
  BOTTOM_PRIMARY_BILLBOARD: 'Bottom Left',
  BOTTOM_SECONDARY_BILLBOARD: 'Bottom Right',
  RIGHT_RAIL_HALF_PAGE: 'Right Rail',
};

const SLOT_COLORS: Record<number, string> = {
  1: '#ecc94b',
  2: '#4299e1',
  3: '#ed8936',
  4: '#38a169',
};

function compressImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
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
      image_url: undefined,
      impressions: a.impressions,
      clicks: a.clicks,
    };
  });
  saveCampaigns(campaigns);
}

function useAdminAds() {
  const setSlotMode = useAppStore(s => s.setSlotMode);
  const setSlotCampaign = useAppStore(s => s.setSlotCampaign);
  const setSlotCreative = useAppStore(s => s.setSlotCreative);
  const setSponsorsEnabled = useAppStore(s => s.setSponsorsEnabled);

  const [ads, setAds] = useState<SponsorAd[]>(() => {
    const stored = getStoredAdminAds();
    if (stored) return stored;
    const mocks = [...MOCK_SPONSOR_ADS];
    syncToFrontend(mocks);
    return mocks;
  });

  // On first mount, sync enabled ads to the Zustand store so the public side picks them up
  const didSync = useRef(false);
  if (!didSync.current) {
    didSync.current = true;
    for (const ad of ads) {
      if (ad.enabled) {
        setSlotMode(ad.slot as string, 'paid_ad');
        setSlotCampaign(ad.slot as string, ad.id);
        if (ad.imageUrl) setSlotCreative(ad.slot as string, { imageUrl: ad.imageUrl });
      }
    }
    setSponsorsEnabled(true);
    notifySlotChange();
  }

  const updateAds = useCallback((updated: SponsorAd[]) => {
    setAds(updated);
    syncToFrontend(updated);
  }, []);

  return { ads, updateAds };
}

function getAdForSlot(ads: SponsorAd[], slotId: PlacementId): SponsorAd | undefined {
  return ads.find(a => a.slot === slotId && a.enabled);
}

// ---------------------------------------------------------------------------
// Placement Map — mirrors the public frontend layout with 4 numbered zones
// ---------------------------------------------------------------------------

function PlacementMap({ ads }: { ads: SponsorAd[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr 1fr 1fr',
      gridTemplateRows: '140px 100px',
      gridTemplateAreas: `
        "left-top   map       map        right-top"
        "left-ad    primary   secondary  right-ad"
      `,
      gap: 3,
      background: 'var(--bg-base)',
      borderRadius: 8,
      border: '1px solid var(--border-subtle)',
      padding: 6,
      marginBottom: 24,
    }}>
      {/* Top left: Priority Developments label */}
      <div style={{ gridArea: 'left-top', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 4, fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
        PRIORITY FEED
      </div>

      {/* Map area */}
      <div style={{ gridArea: 'map', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>
        MAP
      </div>

      {/* Top right: Dashboard label */}
      <div style={{ gridArea: 'right-top', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 4, fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
        DASHBOARD
      </div>

      {/* 4 ad zones */}
      {ALL_PLACEMENT_IDS.map(id => {
        const num = SLOT_NUMBERS[id];
        const color = SLOT_COLORS[num]!;
        const ad = getAdForSlot(ads, id);
        const def = PLACEMENT_REGISTRY.find(p => p.id === id)!;
        const isOn = !!ad;

        return (
          <div
            key={id}
            style={{
              gridArea: def.previewArea,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: 6,
              border: `2px solid ${isOn ? color : '#4a556840'}`,
              borderRadius: 4,
              background: isOn ? `${color}15` : 'transparent',
              overflow: 'hidden',
            }}
          >
            {ad?.imageUrl ? (
              <img src={ad.imageUrl} alt={ad.name} style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'contain', borderRadius: 2 }} />
            ) : (
              <div style={{ fontSize: 24, fontWeight: 800, color: isOn ? color : '#4a5568', opacity: 0.5 }}>{num}</div>
            )}
            <div style={{ fontSize: 8, fontWeight: 700, color: isOn ? color : '#4a5568', textTransform: 'uppercase' }}>
              {isOn ? 'ON' : 'OFF'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single Ad Slot Card — the core UI for each of the 4 slots
// ---------------------------------------------------------------------------

function AdSlotCard({
  slotId,
  ads,
  onUpdateAds,
}: {
  slotId: PlacementId;
  ads: SponsorAd[];
  onUpdateAds: (ads: SponsorAd[]) => void;
}) {
  const num = SLOT_NUMBERS[slotId];
  const color = SLOT_COLORS[num]!;
  const label = SLOT_SHORT_LABELS[slotId];
  const ad = getAdForSlot(ads, slotId);
  const setSlotMode = useAppStore(s => s.setSlotMode);
  const setSlotCampaign = useAppStore(s => s.setSlotCampaign);
  const setSlotCreative = useAppStore(s => s.setSlotCreative);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDuration, setEditDuration] = useState('30d');
  const [editPaid, setEditPaid] = useState('0');

  const isOn = !!ad;

  const handleToggle = () => {
    if (ad) {
      const updated = ads.map(a => a.id === ad.id ? { ...a, enabled: false } : a);
      onUpdateAds(updated);
      setSlotMode(slotId, 'hidden');
      setSlotCampaign(slotId, null);
      notifySlotChange();
    } else {
      const existing = ads.find(a => a.slot === slotId);
      if (existing) {
        const updated = ads.map(a => a.id === existing.id ? { ...a, enabled: true } : a);
        onUpdateAds(updated);
        setSlotCampaign(slotId, existing.id);
        setSlotMode(slotId, 'paid_ad');
        setSlotCreative(slotId, { imageUrl: existing.imageUrl ?? null });
        notifySlotChange();
      } else {
        const newAd: SponsorAd = {
          id: `ad-${slotId}-${Date.now()}`,
          name: `Ad ${num}`,
          slot: slotId,
          enabled: true,
          size: 'standard',
          tagline: '',
          websiteUrl: '',
          imageUrl: '',
          bgColor: '#1a2332',
          textColor: '#e2e8f0',
          accentColor: color,
          icon: 'shield',
          duration: '30d',
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          impressions: 0,
          clicks: 0,
          paidZAR: 0,
        };
        onUpdateAds([...ads, newAd]);
        setSlotCampaign(slotId, newAd.id);
        setSlotMode(slotId, 'paid_ad');
        notifySlotChange();
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file, 800, 0.7);
      if (ad) {
        const updated = ads.map(a => a.id === ad.id ? { ...a, imageUrl: dataUrl } : a);
        onUpdateAds(updated);
        setSlotCreative(slotId, { imageUrl: dataUrl });
        notifySlotChange();
      }
    } catch {
      // compression or storage failed
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveEdit = () => {
    if (ad && editName.trim()) {
      const durationMs: Record<string, number> = { '24h': 86400000, '48h': 172800000, '7d': 604800000, '30d': 2592000000 };
      const ms = durationMs[editDuration] ?? 604800000;
      const now = new Date();
      const updated = ads.map(a => a.id === ad.id ? {
        ...a,
        name: editName,
        tagline: editTagline,
        websiteUrl: editUrl,
        duration: editDuration as SponsorAd['duration'],
        paidZAR: Number(editPaid) || 0,
        startedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ms).toISOString(),
      } : a);
      onUpdateAds(updated);
    }
    setEditing(false);
  };

  const startEdit = () => {
    setEditName(ad?.name ?? `Ad ${num}`);
    setEditTagline(ad?.tagline ?? '');
    setEditUrl(ad?.websiteUrl ?? '');
    setEditDuration(ad?.duration ?? '30d');
    setEditPaid(String(ad?.paidZAR ?? 0));
    setEditing(true);
  };

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${isOn ? `${color}60` : 'var(--border-subtle)'}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {/* Header with number, name, toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: isOn ? `${color}08` : 'transparent',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: isOn ? color : '#4a5568',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#fff',
        }}>
          {num}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {ad?.name || `Ad ${num}`}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
        </div>
        <button
          onClick={handleToggle}
          style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${isOn ? '#38a16940' : '#4a556840'}`,
            background: isOn ? '#38a16920' : 'transparent',
            color: isOn ? '#38a169' : '#4a5568',
          }}
        >
          {isOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Image area */}
      <div style={{ padding: 10 }}>
        {ad?.imageUrl ? (
          <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: 8 }}>
            <img src={ad.imageUrl} alt={ad.name} style={{ width: '100%', height: 80, objectFit: 'contain', display: 'block', background: '#0a0f1a' }} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 9, padding: '3px 8px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 3, color: '#e2e8f0', cursor: 'pointer' }}
            >
              Change
            </button>
          </div>
        ) : isOn ? (
          <div style={{ padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 6, marginBottom: 8 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ fontSize: 11, padding: '6px 14px', background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 4, color, cursor: 'pointer', fontWeight: 600 }}
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
          </div>
        ) : (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            Turn on to configure
          </div>
        )}

        {/* Campaign details + edit */}
        {isOn && !editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(ad?.tagline || ad?.websiteUrl || (ad?.paidZAR ?? 0) > 0) && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
                {ad?.tagline && <div style={{ fontStyle: 'italic' }}>{ad.tagline}</div>}
                {ad?.websiteUrl && <div style={{ color: '#4299e1' }}>{ad.websiteUrl}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  {ad?.duration && <span>Duration: {ad.duration}</span>}
                  {(ad?.paidZAR ?? 0) > 0 && <span>Paid: R{ad!.paidZAR.toLocaleString()}</span>}
                </div>
                {ad?.expiresAt && (
                  <div style={{ fontSize: 9, color: new Date(ad.expiresAt).getTime() < Date.now() ? '#c53030' : 'var(--text-muted)' }}>
                    {new Date(ad.expiresAt).getTime() < Date.now() ? 'Expired' : `Expires: ${new Date(ad.expiresAt).toLocaleDateString()}`}
                  </div>
                )}
              </div>
            )}
            <button onClick={startEdit} style={{ fontSize: 10, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Edit details
            </button>
          </div>
        )}
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Sponsor / Ad name"
              style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}
            />
            <input
              value={editTagline}
              onChange={e => setEditTagline(e.target.value)}
              placeholder="Tagline (optional)"
              style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}
            />
            <input
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              placeholder="Website URL"
              style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Duration</div>
                <select
                  value={editDuration}
                  onChange={e => setEditDuration(e.target.value)}
                  style={{ width: '100%', fontSize: 11, padding: '4px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }}
                >
                  <option value="24h">24 Hours</option>
                  <option value="48h">48 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">1 Month</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid (ZAR)</div>
                <input
                  type="number"
                  value={editPaid}
                  onChange={e => setEditPaid(e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', fontSize: 11, padding: '4px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleSaveEdit} style={{ flex: 1, fontSize: 10, padding: '4px 8px', background: '#38a16918', border: '1px solid #38a16940', borderRadius: 4, color: '#38a169', cursor: 'pointer', fontWeight: 600 }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ fontSize: 10, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
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
      <span style={{ fontSize: 10, fontWeight: 700, color: '#d69e2e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Test</span>
      {seeded ? (
        <button onClick={handleClear} style={{ fontSize: 11, padding: '4px 10px', background: '#c5303018', border: '1px solid #c5303040', borderRadius: 4, color: '#c53030', cursor: 'pointer', fontWeight: 600 }}>
          Clear test data
        </button>
      ) : (
        <button onClick={handleSeed} style={{ fontSize: 11, padding: '4px 10px', background: '#38a16918', border: '1px solid #38a16940', borderRadius: 4, color: '#38a169', cursor: 'pointer', fontWeight: 600 }}>
          Seed test ads
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Page — simplified
// ---------------------------------------------------------------------------

export function AdminSponsors() {
  const sponsorsEnabled = useAppStore(s => s.sponsorsEnabled);
  const setSponsorsEnabled = useAppStore(s => s.setSponsorsEnabled);
  const { ads, updateAds } = useAdminAds();

  const activeCount = ALL_PLACEMENT_IDS.filter(id => getAdForSlot(ads, id)).length;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Ad Manager</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {activeCount}/4 ads active
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TestModeControls />
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: '8px 14px', borderRadius: 8,
            background: sponsorsEnabled ? '#38a16915' : '#c5303015',
            border: `1px solid ${sponsorsEnabled ? '#38a16940' : '#c5303040'}`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: sponsorsEnabled ? '#38a169' : '#c53030' }}>
              Ads {sponsorsEnabled ? 'ON' : 'OFF'}
            </span>
            <input type="checkbox" checked={sponsorsEnabled} onChange={e => setSponsorsEnabled(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </label>
        </div>
      </div>

      {/* Placement Map */}
      <PlacementMap ads={ads} />

      {/* 4 Ad Slot Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {ALL_PLACEMENT_IDS.map(id => (
          <AdSlotCard key={id} slotId={id} ads={ads} onUpdateAds={updateAds} />
        ))}
      </div>
    </div>
  );
}
