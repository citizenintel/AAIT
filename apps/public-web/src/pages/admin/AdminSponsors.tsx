import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
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
  resolvePublicPlacement,
  type PlacementId,
  type ContentAsset,
  type PlacementContext,
} from '@/lib/content-slots';
import { INFOGRAPHIC_LABELS } from '@/components/widgets/ManagedContentSlot';

const SIZE_LABELS: Record<string, string> = { premium: 'Premium', standard: 'Standard', compact: 'Compact' };

const MODE_LABELS: Record<string, string> = {
  disabled: 'Disabled',
  manual: 'Manual',
  auto: 'Auto',
  fallback_only: 'Fallback Only',
};
const MODE_OPTIONS = ['auto', 'manual', 'fallback_only', 'disabled'] as const;

const MODE_DESCRIPTIONS: Record<string, string> = {
  disabled: 'Slot collapsed — nothing renders',
  manual: 'Render the explicitly assigned campaign',
  auto: 'Choose from active campaigns for this placement',
  fallback_only: 'No paid content — show platform fallback or collapse',
};

const LEGACY_MODE_MAP: Record<string, string> = {
  paid_ad: 'manual',
  infographic: 'fallback_only',
  placeholder: 'fallback_only',
  hidden: 'disabled',
};

function normalizeLegacyMode(mode: string): string {
  return LEGACY_MODE_MAP[mode] ?? mode;
}

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

function getPublicResult(
  placementId: PlacementId,
  ads: SponsorAd[],
  sponsorsEnabled: boolean,
  slotMode: string,
  globalInfographicFallback: boolean,
  enabledInfographicTypes: string[],
): { label: string; detail: string; color: string } {
  const mode = normalizeLegacyMode(slotMode);
  const campaigns: CampaignRow[] = ads
    .filter(a => a.enabled && new Date(a.expiresAt).getTime() > Date.now())
    .map(a => ({
      id: a.id, sponsor_id: a.id, name: a.name, size: a.size,
      placement: a.slot, status: 'active', starts_at: a.startedAt,
      ends_at: a.expiresAt, display_name: a.name, tagline: a.tagline,
      link_url: a.websiteUrl, logo_path: null, image_url: a.imageUrl,
    }));

  const ctx: PlacementContext = {
    globalPublicMode: sponsorsEnabled,
    placementMode: mode === 'disabled' ? 'hidden' : mode === 'manual' ? 'paid_ad' : mode === 'fallback_only' ? 'infographic' : 'auto',
    campaigns,
    globalInfographicFallback,
    enabledInfographicTypes,
  };
  const resolved = resolvePublicPlacement(ctx, placementId);

  if (resolved.type === 'sponsor') {
    const placementDef = PLACEMENT_REGISTRY.find(p => p.id === placementId);
    if (!placementDef?.allowsTextCard && !resolved.imageUrl) {
      return { label: 'CREATIVE REQUIRED', detail: `${resolved.displayName} — compatible ${placementDef?.referenceWidth}×${placementDef?.referenceHeight} creative needed`, color: '#d69e2e' };
    }
    return { label: 'VISIBLE', detail: resolved.displayName, color: '#38a169' };
  }
  if (resolved.type === 'infographic') {
    return { label: 'FALLBACK', detail: INFOGRAPHIC_LABELS[resolved.infographicType] ?? resolved.infographicType, color: '#4299e1' };
  }
  if (resolved.type === 'placeholder') {
    return { label: 'PLACEHOLDER', detail: 'Uploaded image', color: '#9f7aea' };
  }

  if (!sponsorsEnabled) return { label: 'NOT VISIBLE', detail: 'Public sponsorship is OFF', color: '#c53030' };
  if (mode === 'disabled') return { label: 'DISABLED', detail: 'Placement mode is Disabled', color: '#636366' };
  const hasCampaign = ads.some(a => a.slot === placementId && a.enabled && getStatus(a) === 'active');
  if (!hasCampaign) return { label: 'EMPTY', detail: 'No active campaign assigned', color: '#d69e2e' };
  return { label: 'NOT VISIBLE', detail: 'No eligible content', color: '#c53030' };
}

// ---------------------------------------------------------------------------
// Shared state hook — single source of truth for admin ads
// ---------------------------------------------------------------------------

function useAdminAds() {
  const [ads, setAds] = useState<SponsorAd[]>(() => {
    const stored = getStoredAdminAds();
    return stored ?? [...MOCK_SPONSOR_ADS];
  });

  const updateAds = useCallback((updated: SponsorAd[]) => {
    setAds(updated);
    syncToFrontend(updated);
  }, []);

  return { ads, updateAds };
}

// ---------------------------------------------------------------------------
// Placement Drawer — opens when clicking a placement in the map
// ---------------------------------------------------------------------------

function PlacementDrawer({
  placementId,
  ads,
  onUpdateAds,
  onClose,
}: {
  placementId: PlacementId;
  ads: SponsorAd[];
  onUpdateAds: (ads: SponsorAd[]) => void;
  onClose: () => void;
}) {
  const def = PLACEMENT_REGISTRY.find(p => p.id === placementId)!;
  const slotAssignments = useAppStore(s => s.slotAssignments);
  const sponsorsEnabled = useAppStore(s => s.sponsorsEnabled);
  const globalInfographicFallback = useAppStore(s => s.globalInfographicFallback);
  const enabledInfographicTypes = useAppStore(s => s.enabledInfographicTypes);
  const setSlotMode = useAppStore(s => s.setSlotMode);
  const assignment = slotAssignments[placementId];
  const mode = normalizeLegacyMode(assignment?.mode ?? 'auto');

  const campaign = ads.find(a => a.slot === placementId && a.enabled && getStatus(a) === 'active');
  const allForSlot = ads.filter(a => a.slot === placementId);
  const result = getPublicResult(placementId, ads, sponsorsEnabled, mode, globalInfographicFallback, enabledInfographicTypes);

  const [assigning, setAssigning] = useState(false);
  const [assignCampaignId, setAssignCampaignId] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const assets = useMemo(() => getAssetsByType('placeholder'), []);

  const unassignedCampaigns = ads.filter(a => {
    if (a.slot === placementId) return false;
    const otherSlotCampaign = ads.find(o => o.slot === a.slot && o.id !== a.id && o.enabled);
    return true;
  });

  const handleAssignExisting = (campaignId: string) => {
    const updated = ads.map(a => a.id === campaignId ? { ...a, slot: placementId } : a);
    onUpdateAds(updated);
    setAssigning(false);
  };

  const handleClearAssignment = () => {
    const updated = ads.map(a => a.slot === placementId ? { ...a, enabled: false } : a);
    onUpdateAds(updated);
  };

  const handleAssignImage = (imageData: string) => {
    if (campaign) {
      const updated = ads.map(a => a.id === campaign.id ? { ...a, imageUrl: imageData } : a);
      onUpdateAds(updated);
    }
    setShowImagePicker(false);
  };

  const handleRemoveImage = () => {
    if (campaign) {
      const updated = ads.map(a => a.id === campaign.id ? { ...a, imageUrl: undefined } : a);
      onUpdateAds(updated);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', zIndex: 1000, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.3)' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{def.publicLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {placementId} · {def.referenceWidth}×{def.referenceHeight}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>×</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Current result */}
        <div style={{ padding: '10px 14px', background: `${result.color}12`, border: `1px solid ${result.color}40`, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: result.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Current public result
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: result.color }}>{result.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{result.detail}</div>
        </div>

        {/* Placement details */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Placement Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            <div style={{ padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>SIZE</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{def.referenceWidth}×{def.referenceHeight}</div>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>CREATIVE FAMILY</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{def.creativeFamily}</div>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>FIT MODE</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{def.defaultFitMode}</div>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 2 }}>TEXT CARD</div>
              <div style={{ color: def.allowsTextCard ? '#38a169' : '#d69e2e', fontWeight: 600 }}>
                {def.allowsTextCard ? 'Allowed' : 'Image required'}
              </div>
            </div>
          </div>
        </div>

        {/* Creative compatibility warning */}
        {campaign && !campaign.imageUrl && !def.allowsTextCard && (
          <div style={{ padding: '10px 14px', background: '#d69e2e12', border: '1px solid #d69e2e40', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#d69e2e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Creative Required
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              This placement requires a {def.referenceWidth}×{def.referenceHeight} ({def.creativeFamily}) image creative. Text-only cards are not supported. Upload or assign a creative to make this campaign visible.
            </div>
          </div>
        )}

        {/* Placement mode */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Placement Mode</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {MODE_OPTIONS.filter(m => m !== 'fallback_only' || def.allowsTextCard).map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: mode === m ? '#c9a84c12' : 'var(--bg-base)', border: `1px solid ${mode === m ? '#c9a84c40' : 'var(--border-subtle)'}`, borderRadius: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`mode-${placementId}`}
                  checked={mode === m}
                  onChange={() => {
                    const storeMode = m === 'disabled' ? 'hidden' : m === 'manual' ? 'paid_ad' : m === 'fallback_only' ? 'infographic' : 'auto';
                    setSlotMode(placementId, storeMode);
                  }}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: mode === m ? '#c9a84c' : 'var(--text-primary)' }}>{MODE_LABELS[m]}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{MODE_DESCRIPTIONS[m]}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Assigned campaign */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Assigned Campaign</div>
          {campaign ? (
            <div style={{ padding: '12px 14px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{campaign.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{campaign.tagline}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: STATUS_STYLES.active?.bg, color: STATUS_STYLES.active?.color, textTransform: 'uppercase' }}>
                  {getStatus(campaign)}
                </span>
              </div>

              {/* Creative thumbnail */}
              {campaign.imageUrl ? (
                <div style={{ marginBottom: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)', position: 'relative' }}>
                  <img src={campaign.imageUrl} alt={campaign.name} style={{ width: '100%', height: 120, objectFit: 'contain', display: 'block', background: '#0a0f1a' }} />
                  <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                    <button onClick={handleRemoveImage} style={{ fontSize: 9, padding: '3px 8px', background: '#c5303088', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 6, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>No creative image assigned</div>
                  <button onClick={() => setShowImagePicker(true)} style={{ fontSize: 11, padding: '4px 12px', background: '#4299e118', border: '1px solid #4299e140', borderRadius: 4, color: '#4299e1', cursor: 'pointer', fontWeight: 600 }}>
                    Select creative
                  </button>
                </div>
              )}

              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeRemaining(campaign.expiresAt)}</div>

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={() => setShowImagePicker(true)} style={{ fontSize: 10, padding: '4px 10px', background: '#4299e118', border: '1px solid #4299e140', borderRadius: 4, color: '#4299e1', cursor: 'pointer', fontWeight: 600 }}>
                  {campaign.imageUrl ? 'Change creative' : 'Add creative'}
                </button>
                <button onClick={() => setAssigning(true)} style={{ fontSize: 10, padding: '4px 10px', background: '#d69e2e18', border: '1px solid #d69e2e40', borderRadius: 4, color: '#d69e2e', cursor: 'pointer', fontWeight: 600 }}>
                  Change campaign
                </button>
                <button onClick={handleClearAssignment} style={{ fontSize: 10, padding: '4px 10px', background: '#c5303018', border: '1px solid #c5303040', borderRadius: 4, color: '#c53030', cursor: 'pointer', fontWeight: 600 }}>
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 8, background: 'var(--bg-base)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>EMPTY</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>No campaign assigned to this placement</div>
              <button onClick={() => setAssigning(true)} style={{ fontSize: 12, padding: '6px 16px', background: '#38a16918', border: '1px solid #38a16940', borderRadius: 6, color: '#38a169', cursor: 'pointer', fontWeight: 600 }}>
                Assign campaign
              </button>
            </div>
          )}
        </div>

        {/* Campaign assignment picker */}
        {assigning && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#c9a84c08', border: '1px solid #c9a84c30', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#c9a84c', marginBottom: 8 }}>Select a campaign to assign</div>
            {ads.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No campaigns available. Create one first.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ads.map(a => {
                  const status = getStatus(a);
                  const isCurrent = a.slot === placementId && a.enabled;
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleAssignExisting(a.id)}
                      disabled={isCurrent}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', background: isCurrent ? '#38a16912' : 'var(--bg-base)',
                        border: `1px solid ${isCurrent ? '#38a16940' : 'var(--border-subtle)'}`,
                        borderRadius: 6, cursor: isCurrent ? 'default' : 'pointer', textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {PLACEMENT_LABELS[a.slot]} · {status}
                          {isCurrent && ' (current)'}
                        </div>
                      </div>
                      {a.imageUrl && (
                        <img src={a.imageUrl} alt="" style={{ width: 40, height: 28, objectFit: 'contain', borderRadius: 3, background: '#0a0f1a' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => setAssigning(false)} style={{ fontSize: 10, padding: '4px 10px', marginTop: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* Image picker from Creative Library */}
        {showImagePicker && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#4299e108', border: '1px solid #4299e130', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4299e1', marginBottom: 8 }}>Select creative from library</div>
            {assets.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No images in creative library. Upload one first.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {assets.map(asset => {
                  const thumb = getImageData(asset.id);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => thumb && handleAssignImage(thumb)}
                      style={{ padding: 0, background: '#0a0f1a', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer', overflow: 'hidden' }}
                    >
                      {thumb && <img src={thumb} alt={asset.alt} style={{ width: '100%', height: 60, objectFit: 'cover', display: 'block' }} />}
                      <div style={{ padding: '3px 6px', fontSize: 9, color: 'var(--text-secondary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.label}</div>
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => setShowImagePicker(false)} style={{ fontSize: 10, padding: '4px 10px', marginTop: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* All campaigns for this slot */}
        {allForSlot.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Campaign History</div>
            {allForSlot.map(a => {
              const s = getStatus(a);
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)', marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{a.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: STATUS_STYLES[s]?.bg, color: STATUS_STYLES[s]?.color, textTransform: 'uppercase' }}>{s}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Overlay backdrop for the drawer
function DrawerBackdrop({ onClick }: { onClick: () => void }) {
  return <div onClick={onClick} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />;
}

// ---------------------------------------------------------------------------
// Placement Map — clickable wireframe
// ---------------------------------------------------------------------------

function PlacementMap({ ads, onSelectPlacement }: { ads: SponsorAd[]; onSelectPlacement: (id: PlacementId) => void }) {
  const slotAssignments = useAppStore(s => s.slotAssignments);
  const sponsorsEnabled = useAppStore(s => s.sponsorsEnabled);
  const globalInfographicFallback = useAppStore(s => s.globalInfographicFallback);
  const enabledInfographicTypes = useAppStore(s => s.enabledInfographicTypes);

  function slotStatus(id: PlacementId): 'active' | 'creative-required' | 'empty' | 'hidden' {
    const assignment = slotAssignments[id];
    const mode = normalizeLegacyMode(assignment?.mode ?? 'auto');
    if (mode === 'disabled') return 'hidden';
    if (!sponsorsEnabled && mode !== 'fallback_only') return 'hidden';
    const campaign = ads.find(a => a.slot === id && a.enabled);
    if (campaign && getStatus(campaign) === 'active') {
      const def = PLACEMENT_REGISTRY.find(p => p.id === id);
      if (!def?.allowsTextCard && !campaign.imageUrl) return 'creative-required';
      return 'active';
    }
    return 'empty';
  }

  const statusColor = (s: string) => {
    if (s === 'active') return '#38a169';
    if (s === 'hidden') return '#636366';
    if (s === 'creative-required') return '#d69e2e';
    return '#64748b';
  };

  const statusLabel = (s: string) => {
    if (s === 'active') return 'ACTIVE';
    if (s === 'hidden') return 'DISABLED';
    if (s === 'creative-required') return 'CREATIVE REQUIRED';
    return 'EMPTY';
  };

  const renderPlacementZone = (id: PlacementId) => {
    const def = PLACEMENT_REGISTRY.find(p => p.id === id)!;
    const s = slotStatus(id);
    const color = statusColor(s);
    const campaign = ads.find(a => a.slot === id && a.enabled && getStatus(a) === 'active');
    const hasValidCreative = !!(campaign?.imageUrl);

    return (
      <button
        onClick={() => onSelectPlacement(id)}
        style={{
          gridArea: def.previewArea,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, padding: 6, border: `2px solid ${color}`, borderRadius: 4,
          background: `${color}12`, cursor: 'pointer', transition: 'border-color 0.15s',
          overflow: 'hidden', minWidth: 0, minHeight: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9a84c'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = color; }}
        title={`Click to manage: ${def.publicLabel}`}
      >
        {hasValidCreative ? (
          <img src={campaign!.imageUrl} alt={campaign!.name} style={{
            width: '100%', flex: 1, minHeight: 0, objectFit: 'contain',
            borderRadius: 2, background: '#0a0f1a',
          }} />
        ) : null}
        <div style={{ fontSize: 8, fontWeight: 700, color, textAlign: 'center', lineHeight: 1.2 }}>
          {campaign ? campaign.name : def.publicLabel.split('—')[1]?.trim() || def.publicLabel}
        </div>
        <div style={{
          fontSize: 7, fontWeight: 700, padding: '1px 6px', borderRadius: 2,
          background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {statusLabel(s)}
        </div>
      </button>
    );
  };

  return (
    <div className="admin-card" style={{ marginBottom: 24, padding: 20 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 14 }}>Placement Map</h2>
      <p style={{ margin: '0 0 12px', fontSize: 10, color: 'var(--text-muted)' }}>
        Click any placement to manage it. Layout matches the public frontend.
      </p>
      <div className="placement-preview" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(100px, 0.7fr) minmax(220px, 1.7fr) minmax(180px, 1.2fr) minmax(100px, 0.7fr)',
        gridTemplateRows: 'minmax(130px, 1fr) minmax(90px, 0.55fr)',
        gridTemplateAreas: `
          "left-top   map       map        right-top"
          "left-ad    primary   secondary  right-ad"
        `,
        width: '100%', aspectRatio: '16 / 8', gap: 4,
        background: 'var(--bg-base)', borderRadius: 8,
        border: '1px solid var(--border-subtle)', padding: 8,
      }}>
        {/* Top-left: label area above left ad */}
        <div style={{
          gridArea: 'left-top', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', padding: 8,
          border: '1px dashed var(--border)', borderRadius: 4,
          fontSize: 8, color: 'var(--text-muted)', textAlign: 'center',
        }}>
          <div style={{ fontWeight: 700, fontSize: 9, marginBottom: 4 }}>LEFT RAIL</div>
          <div>Priority Developments</div>
        </div>

        {/* Map area — spans two center columns, top row */}
        <div style={{
          gridArea: 'map', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px dashed var(--border)', borderRadius: 4,
          color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
        }}>
          MAP AREA
        </div>

        {/* Top-right: label area above right ad */}
        <div style={{
          gridArea: 'right-top', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', padding: 8,
          border: '1px dashed var(--border)', borderRadius: 4,
          fontSize: 8, color: 'var(--text-muted)', textAlign: 'center',
        }}>
          <div style={{ fontWeight: 700, fontSize: 9, marginBottom: 4 }}>RIGHT RAIL</div>
          <div>Dashboard Summary</div>
        </div>

        {/* Four ad placements — driven from registry */}
        {PLACEMENT_REGISTRY.map(def => (
          <React.Fragment key={def.id}>
            {renderPlacementZone(def.id)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot Card with current result
// ---------------------------------------------------------------------------

function SlotCard({ placementId, ads, onSelect }: { placementId: PlacementId; ads: SponsorAd[]; onSelect: () => void }) {
  const def = PLACEMENT_REGISTRY.find(p => p.id === placementId)!;
  const slotAssignments = useAppStore(s => s.slotAssignments);
  const setSlotMode = useAppStore(s => s.setSlotMode);
  const sponsorsEnabled = useAppStore(s => s.sponsorsEnabled);
  const globalInfographicFallback = useAppStore(s => s.globalInfographicFallback);
  const enabledInfographicTypes = useAppStore(s => s.enabledInfographicTypes);
  const assignment = slotAssignments[placementId];
  const rawMode = assignment?.mode ?? 'auto';
  const mode = normalizeLegacyMode(rawMode);
  const campaign = ads.find(a => a.slot === placementId && a.enabled);
  const status = campaign ? getStatus(campaign) : null;
  const result = getPublicResult(placementId, ads, sponsorsEnabled, mode, globalInfographicFallback, enabledInfographicTypes);

  return (
    <div className="admin-card" style={{ padding: 14, cursor: 'pointer', transition: 'border-color 0.15s' }} onClick={onSelect}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{def.publicLabel}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{def.referenceWidth}×{def.referenceHeight}</div>
        </div>
        {status && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: STATUS_STYLES[status]?.bg, color: STATUS_STYLES[status]?.color, textTransform: 'uppercase' }}>
            {status}
          </span>
        )}
      </div>

      {campaign && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, padding: '4px 8px', background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
          <strong>{campaign.name}</strong>
          {campaign.imageUrl && <span style={{ fontSize: 9, color: '#38a169', marginLeft: 6 }}>has creative</span>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Mode:</label>
        <select
          value={mode}
          onChange={e => {
            const m = e.target.value;
            const storeMode = m === 'disabled' ? 'hidden' : m === 'manual' ? 'paid_ad' : m === 'fallback_only' ? 'infographic' : 'auto';
            setSlotMode(placementId, storeMode);
          }}
          onClick={e => e.stopPropagation()}
          style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          {MODE_OPTIONS.filter(m => m !== 'fallback_only' || def.allowsTextCard).map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </select>
      </div>

      {/* Current result */}
      <div style={{ fontSize: 10, padding: '4px 8px', background: `${result.color}08`, borderRadius: 4, border: `1px solid ${result.color}25` }}>
        <span style={{ fontWeight: 700, color: result.color }}>{result.label}</span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{result.detail}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset Library — upload + assign to campaigns
// ---------------------------------------------------------------------------

function AssetLibrary({ ads, onUpdateAds }: { ads: SponsorAd[]; onUpdateAds: (ads: SponsorAd[]) => void }) {
  const [assets, setAssets] = useState(() => { migrateFromLegacy(); return getAssetsByType('placeholder'); });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<string | null>(null);
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

  const handleAssignToCampaign = (assetId: string, campaignId: string) => {
    const imageData = getImageData(assetId);
    if (!imageData) return;
    const updated = ads.map(a => a.id === campaignId ? { ...a, imageUrl: imageData } : a);
    onUpdateAds(updated);
    setAssigningAsset(null);
  };

  const getAssignedCampaign = (assetId: string): SponsorAd | undefined => {
    const imageData = getImageData(assetId);
    if (!imageData) return undefined;
    return ads.find(a => a.imageUrl === imageData);
  };

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Creative Library</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Upload images, assign to campaigns, and manage creatives.
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {assets.map(asset => {
            const thumb = getImageData(asset.id);
            const assigned = getAssignedCampaign(asset.id);
            const isAssigning = assigningAsset === asset.id;

            return (
              <div key={asset.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                <div style={{ height: 60, background: '#0a0f1a', overflow: 'hidden', position: 'relative' }}>
                  {thumb && <img src={thumb} alt={asset.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </div>
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.label}</div>
                  {assigned ? (
                    <div style={{ fontSize: 9, color: '#38a169', marginBottom: 4 }}>
                      Assigned: <strong>{assigned.name}</strong>
                      <div style={{ color: 'var(--text-muted)' }}>{PLACEMENT_LABELS[assigned.slot]}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>Not assigned</div>
                  )}

                  {isAssigning ? (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#4299e1', marginBottom: 3 }}>Assign to campaign:</div>
                      {ads.map(a => (
                        <button key={a.id} onClick={() => handleAssignToCampaign(asset.id, a.id)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 9, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, marginBottom: 2, cursor: 'pointer', color: 'var(--text-primary)' }}>
                          {a.name}
                          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{PLACEMENT_LABELS[a.slot]?.split('—')[0]}</span>
                        </button>
                      ))}
                      <button onClick={() => setAssigningAsset(null)} style={{ fontSize: 9, padding: '2px 6px', marginTop: 2, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 3, cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setAssigningAsset(asset.id)} style={{ fontSize: 9, padding: '2px 6px', background: '#4299e110', border: '1px solid #4299e130', borderRadius: 3, cursor: 'pointer', color: '#4299e1', fontWeight: 600, flex: 1 }}>Assign</button>
                      <button onClick={() => handleRemove(asset.id)} style={{ fontSize: 9, padding: '2px 6px', background: 'none', border: '1px solid #c5303040', borderRadius: 3, cursor: 'pointer', color: '#c53030' }}>✕</button>
                    </div>
                  )}
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
  const hasTextCardPlacements = PLACEMENT_REGISTRY.some(p => p.allowsTextCard);

  return (
    <div className="admin-card" style={{ marginBottom: 24, opacity: hasTextCardPlacements ? 1 : 0.6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Platform Fallback Content</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {hasTextCardPlacements
              ? 'When enabled, empty slots show data visualisations instead of hiding.'
              : 'Not available — all placements require full-size image creatives.'}
          </p>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>N/A</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns Table — enhanced with creative, assignment, public result
// ---------------------------------------------------------------------------

function CampaignsTable({ ads, onUpdateAds }: { ads: SponsorAd[]; onUpdateAds: (ads: SponsorAd[]) => void }) {
  const sponsorsEnabled = useAppStore(s => s.sponsorsEnabled);
  const slotAssignments = useAppStore(s => s.slotAssignments);
  const globalInfographicFallback = useAppStore(s => s.globalInfographicFallback);
  const enabledInfographicTypes = useAppStore(s => s.enabledInfographicTypes);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSize, setNewSize] = useState<string>('standard');
  const [newSlot, setNewSlot] = useState<PlacementId>('LEFT_RAIL_HALF_PAGE');

  const toggleAd = (id: string) => {
    const updated = ads.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    onUpdateAds(updated);
  };

  const setDuration = (id: string, duration: AdDuration) => {
    const now = new Date().toISOString();
    const ms: Record<string, number> = { '24h': 86400000, '48h': 172800000, '7d': 604800000, '30d': 2592000000 };
    const updated = ads.map(a => {
      if (a.id !== id) return a;
      return { ...a, duration, startedAt: now, expiresAt: new Date(Date.now() + (ms[duration] ?? 604800000)).toISOString(), paidZAR: calcPrice(duration, a.size) };
    });
    onUpdateAds(updated);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const ad = await createMockCampaign(newName, newTagline, newSize, newSlot, newUrl);
    onUpdateAds([...ads, ad]);
    setShowAddForm(false);
    setNewName('');
    setNewTagline('');
    setNewUrl('');
  };

  const removeAd = (id: string) => {
    onUpdateAds(ads.filter(a => a.id !== id));
  };

  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const totalRevenue = ads.reduce((s, a) => s + a.paidZAR, 0);
  const activeCount = ads.filter(a => getStatus(a) === 'active').length;

  function getCampaignPublicResult(ad: SponsorAd): { label: string; color: string } {
    const status = getStatus(ad);
    if (status !== 'active') return { label: `NOT VISIBLE — Campaign ${status}`, color: '#636366' };
    if (!sponsorsEnabled) return { label: 'NOT VISIBLE — Public sponsorship OFF', color: '#c53030' };
    const assignment = slotAssignments[ad.slot];
    const mode = normalizeLegacyMode(assignment?.mode ?? 'auto');
    if (mode === 'disabled') return { label: 'NOT VISIBLE — Placement disabled', color: '#636366' };
    const def = PLACEMENT_REGISTRY.find(p => p.id === ad.slot);
    if (def && !def.allowsTextCard && !ad.imageUrl) {
      return { label: `CREATIVE REQUIRED — ${def.referenceWidth}×${def.referenceHeight}`, color: '#d69e2e' };
    }
    return { label: 'VISIBLE', color: '#38a169' };
  }

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
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, width: 50 }}>Creative</th>
              <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Placement</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Status</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Public</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Duration</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Stats</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map(ad => {
              const status = getStatus(ad);
              const style = STATUS_STYLES[status]!;
              const publicResult = getCampaignPublicResult(ad);
              return (
                <tr key={ad.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ad.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{ad.tagline}</div>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    {ad.imageUrl ? (
                      <img src={ad.imageUrl} alt="" style={{ width: 40, height: 28, objectFit: 'contain', borderRadius: 3, background: '#0a0f1a', border: '1px solid var(--border-subtle)' }} />
                    ) : (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px', color: 'var(--text-secondary)', fontSize: 10 }}>
                    {PLACEMENT_LABELS[ad.slot]}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: style.bg, color: style.color, textTransform: 'uppercase' }}>
                      {status}
                    </span>
                    {status === 'active' && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{timeRemaining(ad.expiresAt)}</div>}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: publicResult.color }}>{publicResult.label}</span>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <select value={ad.duration} onChange={e => setDuration(ad.id, e.target.value as AdDuration)} style={{ fontSize: 10, padding: '2px 4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-primary)' }}>
                      {Object.entries(DURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
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
// Capacity Indicator
// ---------------------------------------------------------------------------

function CapacityIndicator({ ads }: { ads: SponsorAd[] }) {
  const occupiedCount = ALL_PLACEMENT_IDS.filter(id => {
    const campaign = ads.find(a => a.slot === id && a.enabled);
    return campaign && getStatus(campaign) === 'active';
  }).length;
  const activeCampaigns = ads.filter(a => a.enabled && getStatus(a) === 'active').length;
  const withCreative = ads.filter(a => a.imageUrl).length;

  const counters = [
    { label: 'Occupied', value: occupiedCount, max: 4, color: occupiedCount === 4 ? '#38a169' : '#4299e1' },
    { label: 'Active', value: activeCampaigns, color: '#38a169' },
    { label: 'Creatives', value: withCreative, color: '#9f7aea' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
      {counters.map(c => (
        <div key={c.label} style={{ textAlign: 'center', minWidth: 42 }}>
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
// Main Admin Page
// ---------------------------------------------------------------------------

export function AdminSponsors() {
  const sponsorsEnabled = useAppStore(s => s.sponsorsEnabled);
  const setSponsorsEnabled = useAppStore(s => s.setSponsorsEnabled);
  const storage = useMemo(() => getStorageUsage(), []);

  const { ads, updateAds } = useAdminAds();
  const [drawerPlacement, setDrawerPlacement] = useState<PlacementId | null>(null);

  const occupiedCount = ALL_PLACEMENT_IDS.filter(id => {
    const campaign = ads.find(a => a.slot === id && a.enabled);
    return campaign && getStatus(campaign) === 'active';
  }).length;

  const sponsorStatusText = sponsorsEnabled
    ? `${occupiedCount} of 4 placements are currently visible`
    : 'Paid campaigns will not appear publicly';

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
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 14px', background: sponsorsEnabled ? '#38a16915' : '#c5303015', border: `1px solid ${sponsorsEnabled ? '#38a16940' : '#c5303040'}`, borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: sponsorsEnabled ? '#38a169' : '#c53030' }}>
                Public sponsorship: {sponsorsEnabled ? 'ON' : 'OFF'}
              </span>
              <input type="checkbox" checked={sponsorsEnabled} onChange={e => setSponsorsEnabled(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            </label>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'center' }}>{sponsorStatusText}</div>
          </div>
        </div>
      </div>

      {/* Placement Map + Slot Cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <PlacementMap ads={ads} onSelectPlacement={setDrawerPlacement} />
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 14 }}>Placement Controls</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ALL_PLACEMENT_IDS.map(id => (
              <SlotCard key={id} placementId={id} ads={ads} onSelect={() => setDrawerPlacement(id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns */}
      <CampaignsTable ads={ads} onUpdateAds={updateAds} />

      {/* Asset Library + Infographic side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <AssetLibrary ads={ads} onUpdateAds={updateAds} />
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

      {/* Placement drawer */}
      {drawerPlacement && (
        <>
          <DrawerBackdrop onClick={() => setDrawerPlacement(null)} />
          <PlacementDrawer
            placementId={drawerPlacement}
            ads={ads}
            onUpdateAds={updateAds}
            onClose={() => setDrawerPlacement(null)}
          />
        </>
      )}
    </div>
  );
}
