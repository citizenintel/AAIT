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
  impressions?: number;
  clicks?: number;
}

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

export async function fetchActiveCampaigns(): Promise<CampaignRow[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_SPONSOR_ADS.filter(a => a.enabled).map(a => ({
      id: a.id,
      sponsor_id: a.id,
      name: a.name,
      size: a.size,
      placement: `slot-${a.slot}`,
      status: 'active',
      starts_at: a.startedAt,
      ends_at: a.expiresAt,
      display_name: a.name,
      tagline: a.tagline,
      link_url: a.websiteUrl,
      logo_path: null,
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

export async function createMockCampaign(name: string, tagline: string, size: string, slot: number): Promise<SponsorAd> {
  const now = new Date();
  const expires = new Date(now.getTime() + 604800000);
  const ad: SponsorAd = {
    id: `sp-${Date.now().toString(36)}`,
    name,
    slot: slot as SponsorAd['slot'],
    enabled: true,
    size: size as SponsorAd['size'],
    tagline,
    websiteUrl: '',
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
      placement: `slot-${a.slot}`,
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
