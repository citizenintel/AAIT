import { isSupabaseConfigured, sponsor } from '../supabase';
import { MOCK_SPONSOR_ADS, type SponsorAd } from '../../data/mock-sponsors';

export interface SponsorRow {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  url: string | null;
  description_en: string | null;
  contact_email: string | null;
  is_active: boolean;
  campaigns: CampaignRow[];
}

export interface CampaignRow {
  id: string;
  sponsor_id: string;
  name: string;
  size: string;
  placement: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  display_name: string;
  tagline: string | null;
  link_url: string | null;
  logo_path: string | null;
  image_url?: string;
  impressions?: number;
  clicks?: number;
}

const CAMPAIGNS_STORAGE_KEY = 'aait_campaigns';
const ADMIN_ADS_KEY = 'aait_admin_ads';

export async function fetchSponsors(): Promise<SponsorRow[]> {
  if (!isSupabaseConfigured()) return mockToRows();

  const { data, error } = await sponsor()
    .from('sponsors')
    .select(`
      *,
      campaigns(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function getStoredCampaigns(): CampaignRow[] {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveCampaigns(campaigns: CampaignRow[]): void {
  localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
}

export function getStoredAdminAds(): SponsorAd[] | null {
  try {
    const raw = localStorage.getItem(ADMIN_ADS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function saveAdminAds(ads: SponsorAd[]): void {
  localStorage.setItem(ADMIN_ADS_KEY, JSON.stringify(ads));
}

export async function fetchActiveCampaigns(): Promise<CampaignRow[]> {
  if (!isSupabaseConfigured()) {
    let ads = getStoredAdminAds();
    if (ads) {
      const now = Date.now();
      let refreshed = false;
      ads = ads.map(a => {
        if (a.enabled && new Date(a.expiresAt).getTime() <= now) {
          refreshed = true;
          const durationMs: Record<string, number> = { '24h': 86400000, '48h': 172800000, '7d': 604800000, '30d': 2592000000 };
          const ms = durationMs[a.duration] ?? 604800000;
          return { ...a, startedAt: new Date().toISOString(), expiresAt: new Date(now + ms).toISOString() };
        }
        return a;
      });
      if (refreshed) saveAdminAds(ads);
    }
    const source = ads ?? MOCK_SPONSOR_ADS;
    return source.filter(a => a.enabled).map(a => ({
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
      impressions: a.impressions,
      clicks: a.clicks,
    }));
  }

  const { data, error } = await sponsor()
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .or('ends_at.is.null,ends_at.gt.' + new Date().toISOString());

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSponsor(s: { name: string; slug: string; url?: string; description_en?: string; contact_email?: string }): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Database not configured');

  const { data, error } = await sponsor()
    .from('sponsors')
    .insert(s)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateCampaignStatus(id: string, status: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await sponsor()
    .from('campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function createMockCampaign(name: string, tagline: string, size: string, slot: string, websiteUrl?: string, imageUrl?: string): Promise<SponsorAd> {
  const now = new Date();
  const expires = new Date(now.getTime() + 604800000);
  const ad: SponsorAd = {
    id: `sp-${Date.now().toString(36)}`,
    name,
    slot: slot as SponsorAd['slot'],
    enabled: true,
    size: size as SponsorAd['size'],
    tagline,
    websiteUrl: websiteUrl || '',
    imageUrl: imageUrl || undefined,
    bgColor: '#1a2332',
    textColor: '#e2e8f0',
    accentColor: '#4299e1',
    icon: 'shield',
    duration: '7d',
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    impressions: 0,
    clicks: 0,
    paidZAR: 499,
  };
  return ad;
}

function mockToRows(): SponsorRow[] {
  const grouped = new Map<string, typeof MOCK_SPONSOR_ADS>();
  for (const ad of MOCK_SPONSOR_ADS) {
    if (!grouped.has(ad.name)) grouped.set(ad.name, []);
    grouped.get(ad.name)!.push(ad);
  }

  return Array.from(grouped.entries()).map(([name, ads]) => {
    const first = ads[0]!;
    return {
    id: first.id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    logo_path: null,
    url: first.websiteUrl,
    description_en: first.description ?? null,
    contact_email: null,
    is_active: ads.some(a => a.enabled),
    campaigns: ads.map(a => ({
      id: a.id,
      sponsor_id: a.id,
      name: a.name,
      size: a.size,
      placement: a.slot,
      status: a.enabled ? 'active' : 'paused',
      starts_at: a.startedAt,
      ends_at: a.expiresAt,
      display_name: a.name,
      tagline: a.tagline,
      link_url: a.websiteUrl,
      logo_path: null,
      impressions: a.impressions,
      clicks: a.clicks,
    })),
  };
  });
}
