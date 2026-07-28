import type {
  PlacementId, Sponsor, Campaign, Creative, CreativeVariant, Assignment,
  FitMode,
} from './types';
import type { CampaignRow } from '../api/sponsors';
import { ALL_PLACEMENT_IDS } from './registry';

// ---------------------------------------------------------------------------
// Consolidated sponsor data store — §1, §15
//
// Single localStorage key replaces the former split:
//   aait_admin_ads   (flat SponsorAd[])
//   aait_campaigns   (dead — never read)
//
// The separated model (Sponsor → Campaign → Creative → Assignment) is now
// the single source of truth at runtime.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'aait_sponsor_store';

export interface SponsorStore {
  version: 1;
  sponsors: Sponsor[];
  campaigns: Campaign[];
  creatives: Creative[];
  variants: CreativeVariant[];
  assignments: Assignment[];
}

function emptyStore(): SponsorStore {
  return { version: 1, sponsors: [], campaigns: [], creatives: [], variants: [], assignments: [] };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function loadStore(): SponsorStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) return parsed;
    }
  } catch { /* corrupt — start fresh */ }
  return emptyStore();
}

export function saveStore(store: SponsorStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ---------------------------------------------------------------------------
// Migration: flat SponsorAd[] → separated model
// ---------------------------------------------------------------------------

interface LegacySponsorAd {
  id: string;
  name: string;
  slot: PlacementId;
  enabled: boolean;
  size: string;
  tagline: string;
  description?: string;
  websiteUrl: string;
  imageUrl?: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  icon: string;
  duration: string;
  startedAt: string;
  expiresAt: string;
  impressions: number;
  clicks: number;
  paidZAR: number;
}

export function migrateFromLegacy(): SponsorStore | null {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return null;

  const raw = localStorage.getItem('aait_admin_ads');
  if (!raw) return null;

  try {
    const ads: LegacySponsorAd[] = JSON.parse(raw);
    if (!Array.isArray(ads) || ads.length === 0) return null;

    const store = emptyStore();
    const sponsorMap = new Map<string, string>();

    for (const ad of ads) {
      let sponsorId = sponsorMap.get(ad.name);
      if (!sponsorId) {
        sponsorId = `sponsor-${ad.id}`;
        sponsorMap.set(ad.name, sponsorId);
        store.sponsors.push({
          id: sponsorId,
          name: ad.name,
          status: 'active',
          websiteUrl: ad.websiteUrl,
          disclosureName: ad.name,
          createdAt: ad.startedAt,
          updatedAt: ad.startedAt,
        });
      }

      const campaignId = `campaign-${ad.id}`;
      store.campaigns.push({
        id: campaignId,
        sponsorId,
        name: `${ad.name} Campaign`,
        status: ad.enabled ? 'ACTIVE' : 'PAUSED',
        startAt: ad.startedAt,
        endAt: ad.expiresAt,
        destinationUrl: ad.websiteUrl,
        ctaLabel: 'Learn more',
        disclosureText: 'Sponsored',
        priority: 5,
        deliveryWeight: 1,
        trackingMode: 'basic',
        approvedAt: ad.startedAt,
        approvedBy: 'admin',
        createdAt: ad.startedAt,
        updatedAt: ad.startedAt,
      });

      if (ad.imageUrl) {
        const creativeId = `creative-${ad.id}`;
        store.creatives.push({
          id: creativeId,
          campaignId,
          status: 'APPROVED',
          altText: ad.name,
          fitMode: 'cover',
          focalX: 50,
          focalY: 50,
          backgroundColor: ad.bgColor,
          sourceWidth: 0,
          sourceHeight: 0,
          sourceUrl: ad.imageUrl,
          createdAt: ad.startedAt,
          updatedAt: ad.startedAt,
        });
      }

      store.assignments.push({
        id: `assign-${ad.id}`,
        campaignId,
        placementId: ad.slot,
        status: ad.enabled ? 'ACTIVE' : 'PAUSED',
        startAt: ad.startedAt,
        endAt: ad.expiresAt,
        priority: 5,
        createdBy: 'admin',
        approvedBy: 'admin',
        createdAt: ad.startedAt,
        updatedAt: ad.startedAt,
      });
    }

    saveStore(store);
    return store;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Query helpers — §14 resolver bridge
// ---------------------------------------------------------------------------

export function getActiveCampaignRows(store?: SponsorStore): CampaignRow[] {
  const s = store ?? loadStore();
  const now = Date.now();
  const rows: CampaignRow[] = [];

  for (const assignment of s.assignments) {
    if (assignment.status !== 'ACTIVE') continue;

    const campaign = s.campaigns.find(c => c.id === assignment.campaignId);
    if (!campaign || campaign.status !== 'ACTIVE') continue;

    if (campaign.startAt && new Date(campaign.startAt).getTime() > now) continue;
    if (campaign.endAt && new Date(campaign.endAt).getTime() <= now) continue;

    const sponsor = s.sponsors.find(sp => sp.id === campaign.sponsorId);
    const creative = s.creatives.find(cr => cr.campaignId === campaign.id);

    rows.push({
      id: campaign.id,
      sponsor_id: campaign.sponsorId,
      name: campaign.name,
      size: assignment.placementId === 'GLANCE_RAIL_FEATURED' ? 'premium' : 'standard',
      placement: assignment.placementId,
      status: 'active',
      starts_at: campaign.startAt,
      ends_at: campaign.endAt,
      display_name: sponsor?.disclosureName ?? campaign.name,
      tagline: campaign.disclosureText,
      link_url: campaign.destinationUrl,
      logo_path: null,
      image_url: creative?.sourceUrl,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// CRUD — Sponsors
// ---------------------------------------------------------------------------

export function getSponsor(id: string, store?: SponsorStore): Sponsor | undefined {
  return (store ?? loadStore()).sponsors.find(s => s.id === id);
}

export function upsertSponsor(sponsor: Sponsor): void {
  const store = loadStore();
  const idx = store.sponsors.findIndex(s => s.id === sponsor.id);
  if (idx >= 0) store.sponsors[idx] = sponsor;
  else store.sponsors.push(sponsor);
  saveStore(store);
}

export function deleteSponsor(id: string): void {
  const store = loadStore();
  store.sponsors = store.sponsors.filter(s => s.id !== id);
  store.campaigns = store.campaigns.filter(c => c.sponsorId !== id);
  saveStore(store);
}

// ---------------------------------------------------------------------------
// CRUD — Campaigns
// ---------------------------------------------------------------------------

export function getCampaign(id: string, store?: SponsorStore): Campaign | undefined {
  return (store ?? loadStore()).campaigns.find(c => c.id === id);
}

export function upsertCampaign(campaign: Campaign): void {
  const store = loadStore();
  const idx = store.campaigns.findIndex(c => c.id === campaign.id);
  if (idx >= 0) store.campaigns[idx] = campaign;
  else store.campaigns.push(campaign);
  saveStore(store);
}

export function deleteCampaign(id: string): void {
  const store = loadStore();
  store.campaigns = store.campaigns.filter(c => c.id !== id);
  store.creatives = store.creatives.filter(cr => cr.campaignId !== id);
  store.assignments = store.assignments.filter(a => a.campaignId !== id);
  saveStore(store);
}

// ---------------------------------------------------------------------------
// CRUD — Creatives
// ---------------------------------------------------------------------------

export function getCreative(id: string, store?: SponsorStore): Creative | undefined {
  return (store ?? loadStore()).creatives.find(c => c.id === id);
}

export function getCreativesForCampaign(campaignId: string, store?: SponsorStore): Creative[] {
  return (store ?? loadStore()).creatives.filter(c => c.campaignId === campaignId);
}

export function upsertCreative(creative: Creative): void {
  const store = loadStore();
  const idx = store.creatives.findIndex(c => c.id === creative.id);
  if (idx >= 0) store.creatives[idx] = creative;
  else store.creatives.push(creative);
  saveStore(store);
}

export function deleteCreative(id: string): void {
  const store = loadStore();
  store.creatives = store.creatives.filter(c => c.id !== id);
  store.variants = store.variants.filter(v => v.creativeId !== id);
  saveStore(store);
}

// ---------------------------------------------------------------------------
// CRUD — Creative Variants
// ---------------------------------------------------------------------------

export function getVariantsForCreative(creativeId: string, store?: SponsorStore): CreativeVariant[] {
  return (store ?? loadStore()).variants.filter(v => v.creativeId === creativeId);
}

export function upsertVariant(variant: CreativeVariant): void {
  const store = loadStore();
  const idx = store.variants.findIndex(v => v.id === variant.id);
  if (idx >= 0) store.variants[idx] = variant;
  else store.variants.push(variant);
  saveStore(store);
}

// ---------------------------------------------------------------------------
// CRUD — Assignments
// ---------------------------------------------------------------------------

export function getAssignmentsForPlacement(placementId: PlacementId, store?: SponsorStore): Assignment[] {
  return (store ?? loadStore()).assignments.filter(a => a.placementId === placementId);
}

export function getAssignmentsForCampaign(campaignId: string, store?: SponsorStore): Assignment[] {
  return (store ?? loadStore()).assignments.filter(a => a.campaignId === campaignId);
}

export function upsertAssignment(assignment: Assignment): void {
  const store = loadStore();
  const idx = store.assignments.findIndex(a => a.id === assignment.id);
  if (idx >= 0) store.assignments[idx] = assignment;
  else store.assignments.push(assignment);
  saveStore(store);
}

export function deleteAssignment(id: string): void {
  const store = loadStore();
  store.assignments = store.assignments.filter(a => a.id !== id);
  saveStore(store);
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export function clearSponsorStore(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('aait_admin_ads');
  localStorage.removeItem('aait_campaigns');
}

export function isStoreSeeded(): boolean {
  const store = loadStore();
  return store.campaigns.length > 0;
}
