import { ALL_PLACEMENT_IDS } from './registry';
import { TEST_CREATIVE_URIS, TEST_CREATIVE_SPECS } from './test-creatives';
import { saveAdminAds, getStoredAdminAds, saveCampaigns, type CampaignRow } from '../api/sponsors';
import type { SponsorAd } from '../../data/mock-sponsors';

const BACKUP_ADS_KEY = 'aait_backup_admin_ads';
const BACKUP_CAMPAIGNS_KEY = 'aait_backup_campaigns';
const BACKUP_ASSIGNMENTS_KEY = 'aait_backup_slot_assignments';

function rollingDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}
function rollingExpiry(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString();
}

export function seedTestData(): SponsorAd[] {
  // §11 — save real data before overwriting
  const existingAds = localStorage.getItem('aait_admin_ads');
  const existingCampaigns = localStorage.getItem('aait_campaigns');
  const existingAssignments = localStorage.getItem('aait_slot_assignments');
  if (existingAds && !hasTestRecords(existingAds)) {
    localStorage.setItem(BACKUP_ADS_KEY, existingAds);
  }
  if (existingCampaigns && !hasTestRecords(existingCampaigns)) {
    localStorage.setItem(BACKUP_CAMPAIGNS_KEY, existingCampaigns);
  }
  if (existingAssignments) {
    localStorage.setItem(BACKUP_ASSIGNMENTS_KEY, existingAssignments);
  }

  const icons: SponsorAd['icon'][] = ['shield', 'farm', 'lock', 'web'];
  const ads: SponsorAd[] = TEST_CREATIVE_SPECS.map((spec, i) => ({
    id: `test-${spec.number}`,
    name: spec.sponsorName,
    slot: spec.placementId,
    enabled: true,
    size: spec.placementId === 'LEFT_RAIL_HALF_PAGE' ? 'premium' as const : 'standard' as const,
    tagline: `Test creative #${spec.number} — ${spec.placementId}`,
    websiteUrl: '',
    imageUrl: TEST_CREATIVE_URIS[spec.placementId],
    bgColor: spec.bgColor,
    textColor: '#e2e8f0',
    accentColor: spec.accentColor,
    icon: icons[i]!,
    duration: '30d' as const,
    startedAt: rollingDate(1),
    expiresAt: rollingExpiry(29),
    impressions: 0,
    clicks: 0,
    paidZAR: 0,
  }));

  saveAdminAds(ads);

  const campaigns: CampaignRow[] = ads.map(a => ({
    id: a.id,
    sponsor_id: a.id,
    name: a.name,
    size: a.size,
    placement: a.slot,
    status: 'active',
    starts_at: a.startedAt,
    ends_at: a.expiresAt,
    display_name: a.name,
    tagline: a.tagline,
    link_url: a.websiteUrl,
    logo_path: null,
    image_url: a.imageUrl,
    impressions: 0,
    clicks: 0,
  }));
  saveCampaigns(campaigns);

  const assignments: Record<string, { slotKey: string; assetId: string | null; campaignId: string | null; mode: string }> = {};
  for (const spec of TEST_CREATIVE_SPECS) {
    assignments[spec.placementId] = {
      slotKey: spec.placementId,
      assetId: null,
      campaignId: `test-${spec.number}`,
      mode: 'paid_ad',
    };
  }
  localStorage.setItem('aait_slot_assignments', JSON.stringify(assignments));
  localStorage.setItem('aait_sponsors_enabled', 'true');

  return ads;
}

export function clearTestData(): void {
  // §11 — restore real data if backed up, otherwise remove
  const backupAds = localStorage.getItem(BACKUP_ADS_KEY);
  const backupCampaigns = localStorage.getItem(BACKUP_CAMPAIGNS_KEY);
  const backupAssignments = localStorage.getItem(BACKUP_ASSIGNMENTS_KEY);

  if (backupAds) {
    localStorage.setItem('aait_admin_ads', backupAds);
    localStorage.removeItem(BACKUP_ADS_KEY);
  } else {
    localStorage.removeItem('aait_admin_ads');
  }

  if (backupCampaigns) {
    localStorage.setItem('aait_campaigns', backupCampaigns);
    localStorage.removeItem(BACKUP_CAMPAIGNS_KEY);
  } else {
    localStorage.removeItem('aait_campaigns');
  }

  if (backupAssignments) {
    localStorage.setItem('aait_slot_assignments', backupAssignments);
    localStorage.removeItem(BACKUP_ASSIGNMENTS_KEY);
  } else {
    localStorage.removeItem('aait_slot_assignments');
  }
}

export function isTestDataSeeded(): boolean {
  try {
    const raw = localStorage.getItem('aait_admin_ads');
    if (!raw) return false;
    return hasTestRecords(raw);
  } catch { return false; }
}

function hasTestRecords(json: string): boolean {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) && arr.some((a: { id?: string }) => a.id?.startsWith('test-'));
  } catch { return false; }
}
