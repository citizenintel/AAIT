import { ALL_PLACEMENT_IDS } from './registry';
import { TEST_CREATIVE_URIS, TEST_CREATIVE_SPECS } from './test-creatives';
import { saveAdminAds, saveCampaigns, type CampaignRow } from '../api/sponsors';
import type { SponsorAd } from '../../data/mock-sponsors';

function rollingDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}
function rollingExpiry(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString();
}

export function seedTestData(): SponsorAd[] {
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

  localStorage.setItem('aait_sponsors_enabled', 'true');

  return ads;
}

export function clearTestData(): void {
  localStorage.removeItem('aait_admin_ads');
  localStorage.removeItem('aait_campaigns');
}

export function isTestDataSeeded(): boolean {
  try {
    const raw = localStorage.getItem('aait_admin_ads');
    if (!raw) return false;
    const ads = JSON.parse(raw);
    return Array.isArray(ads) && ads.some((a: { id?: string }) => a.id?.startsWith('test-'));
  } catch { return false; }
}
