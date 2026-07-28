import type { PlacementId, Sponsor, Campaign, Creative, Assignment } from '../lib/content-slots';

// ---------------------------------------------------------------------------
// §2 — Separated data model: Sponsor → Campaign → Creative → Assignment
// ---------------------------------------------------------------------------

export type AdDuration = '24h' | '48h' | '7d' | '30d' | 'custom';

export interface SponsorAd {
  id: string;
  name: string;
  slot: PlacementId;
  enabled: boolean;
  size: 'premium' | 'standard' | 'compact';
  tagline: string;
  description?: string;
  websiteUrl: string;
  imageUrl?: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  icon: 'shield' | 'web' | 'farm' | 'lock';
  duration: AdDuration;
  startedAt: string;
  expiresAt: string;
  impressions: number;
  clicks: number;
  paidZAR: number;
}

export const DURATION_LABELS: Record<AdDuration, string> = {
  '24h': '24 Hours',
  '48h': '48 Hours',
  '7d': '7 Days',
  '30d': '1 Month',
  'custom': 'Custom',
};

export const DURATION_PRICES: Record<AdDuration, number> = {
  '24h': 99,
  '48h': 179,
  '7d': 499,
  '30d': 1499,
  'custom': 0,
};

export const SIZE_PRICES: Record<string, number> = {
  premium: 3,
  standard: 1,
  compact: 0.5,
};

export const PLACEMENT_LABELS: Record<PlacementId, string> = {
  'GLANCE_RAIL_FEATURED': 'Glance Rail — Featured Sponsor',
  'LEFT_RAIL_COMPACT': 'Left Rail — Compact Sponsor',
  'RIGHT_DASHBOARD_RECTANGLE': 'Right Dashboard — Sponsor',
  'BOTTOM_INTELLIGENCE_LEADERBOARD': 'Bottom Intelligence Bar — Sponsor',
};

// Legacy alias
export const SLOT_LABELS = PLACEMENT_LABELS;

function rollingDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}
function rollingExpiry(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString();
}

// ---------------------------------------------------------------------------
// §2 — Demo sponsors (separated model)
// ---------------------------------------------------------------------------

export const MOCK_SPONSORS: Sponsor[] = [
  {
    id: 'sponsor-farmwatch',
    name: 'FarmWatch Alert',
    status: 'active',
    websiteUrl: 'https://farmwatch-demo.co.za',
    disclosureName: 'FarmWatch Alert',
    createdAt: rollingDate(90),
    updatedAt: rollingDate(20),
  },
  {
    id: 'sponsor-agrishield',
    name: 'AgriShield Insurance',
    status: 'active',
    websiteUrl: 'https://agrishield-demo.co.za',
    disclosureName: 'AgriShield Insurance',
    createdAt: rollingDate(60),
    updatedAt: rollingDate(2),
  },
  {
    id: 'sponsor-cybervault',
    name: 'CyberVault',
    status: 'active',
    websiteUrl: 'https://cybervault-demo.co.za',
    disclosureName: 'CyberVault',
    createdAt: rollingDate(45),
    updatedAt: rollingDate(1),
  },
  {
    id: 'sponsor-veldbroadband',
    name: 'Veld Broadband',
    status: 'active',
    websiteUrl: 'https://veldbroadband-demo.co.za',
    disclosureName: 'Veld Broadband',
    createdAt: rollingDate(30),
    updatedAt: rollingDate(5),
  },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'campaign-farmwatch-main',
    sponsorId: 'sponsor-farmwatch',
    name: 'FarmWatch Q3 Awareness',
    status: 'ACTIVE',
    startAt: rollingDate(20),
    endAt: rollingExpiry(10),
    destinationUrl: 'https://farmwatch-demo.co.za',
    ctaLabel: 'Get alerts',
    disclosureText: 'Sponsored',
    priority: 10,
    deliveryWeight: 1,
    trackingMode: 'viewability',
    approvedAt: rollingDate(21),
    approvedBy: 'admin',
    createdAt: rollingDate(25),
    updatedAt: rollingDate(20),
  },
  {
    id: 'campaign-agrishield-main',
    sponsorId: 'sponsor-agrishield',
    name: 'AgriShield Winter Cover',
    status: 'ACTIVE',
    startAt: rollingDate(2),
    endAt: rollingExpiry(5),
    destinationUrl: 'https://agrishield-demo.co.za',
    ctaLabel: 'Get a quote',
    disclosureText: 'Sponsored',
    priority: 5,
    deliveryWeight: 1,
    trackingMode: 'basic',
    approvedAt: rollingDate(3),
    approvedBy: 'admin',
    createdAt: rollingDate(5),
    updatedAt: rollingDate(2),
  },
  {
    id: 'campaign-cybervault-main',
    sponsorId: 'sponsor-cybervault',
    name: 'CyberVault Data Protection',
    status: 'ACTIVE',
    startAt: rollingDate(1),
    endAt: rollingExpiry(6),
    destinationUrl: 'https://cybervault-demo.co.za',
    ctaLabel: 'Secure now',
    disclosureText: 'Sponsored',
    priority: 5,
    deliveryWeight: 1,
    trackingMode: 'basic',
    approvedAt: rollingDate(2),
    approvedBy: 'admin',
    createdAt: rollingDate(3),
    updatedAt: rollingDate(1),
  },
  {
    id: 'campaign-veldbroadband-main',
    sponsorId: 'sponsor-veldbroadband',
    name: 'Veld Broadband Rural Launch',
    status: 'ACTIVE',
    startAt: rollingDate(5),
    endAt: rollingExpiry(25),
    destinationUrl: 'https://veldbroadband-demo.co.za',
    ctaLabel: 'Check coverage',
    disclosureText: 'Sponsored',
    priority: 5,
    deliveryWeight: 1,
    trackingMode: 'viewability',
    approvedAt: rollingDate(6),
    approvedBy: 'admin',
    createdAt: rollingDate(10),
    updatedAt: rollingDate(5),
  },
];

export const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: 'assign-farmwatch-leftrail',
    campaignId: 'campaign-farmwatch-main',
    placementId: 'GLANCE_RAIL_FEATURED',
    status: 'ACTIVE',
    startAt: rollingDate(20),
    endAt: rollingExpiry(10),
    priority: 10,
    createdBy: 'admin',
    approvedBy: 'admin',
    createdAt: rollingDate(20),
    updatedAt: rollingDate(20),
  },
  {
    id: 'assign-agrishield-compact',
    campaignId: 'campaign-agrishield-main',
    placementId: 'LEFT_RAIL_COMPACT',
    status: 'ACTIVE',
    startAt: rollingDate(2),
    endAt: rollingExpiry(5),
    priority: 5,
    createdBy: 'admin',
    approvedBy: 'admin',
    createdAt: rollingDate(2),
    updatedAt: rollingDate(2),
  },
  {
    id: 'assign-cybervault-right',
    campaignId: 'campaign-cybervault-main',
    placementId: 'RIGHT_DASHBOARD_RECTANGLE',
    status: 'ACTIVE',
    startAt: rollingDate(1),
    endAt: rollingExpiry(6),
    priority: 5,
    createdBy: 'admin',
    approvedBy: 'admin',
    createdAt: rollingDate(1),
    updatedAt: rollingDate(1),
  },
  {
    id: 'assign-veldbroadband-bottom',
    campaignId: 'campaign-veldbroadband-main',
    placementId: 'BOTTOM_INTELLIGENCE_LEADERBOARD',
    status: 'ACTIVE',
    startAt: rollingDate(5),
    endAt: rollingExpiry(25),
    priority: 5,
    createdBy: 'admin',
    approvedBy: 'admin',
    createdAt: rollingDate(5),
    updatedAt: rollingDate(5),
  },
];

// ---------------------------------------------------------------------------
// Legacy flat format — still used by sponsors API and admin UI during migration
// ---------------------------------------------------------------------------

export const MOCK_SPONSOR_ADS: SponsorAd[] = [
  {
    id: 'sp-005',
    name: 'FarmWatch Alert',
    slot: 'GLANCE_RAIL_FEATURED',
    enabled: true,
    size: 'premium',
    tagline: 'Real-time farm security alerts straight to your phone',
    description: 'Instant push notifications for farm attacks, rural crime and security incidents in your area. Never be caught off guard.',
    websiteUrl: 'https://farmwatch-demo.co.za',
    bgColor: '#1a2332',
    textColor: '#e2e8f0',
    accentColor: '#ed8936',
    icon: 'shield',
    duration: '30d',
    startedAt: rollingDate(20),
    expiresAt: rollingExpiry(10),
    impressions: 14200,
    clicks: 412,
    paidZAR: 4497,
  },
  {
    id: 'sp-003',
    name: 'AgriShield Insurance',
    slot: 'LEFT_RAIL_COMPACT',
    enabled: true,
    size: 'standard',
    tagline: 'Protecting South African Farmers Since 1998',
    websiteUrl: 'https://agrishield-demo.co.za',
    bgColor: '#1a2e1a',
    textColor: '#e2e8f0',
    accentColor: '#48bb78',
    icon: 'farm',
    duration: '7d',
    startedAt: rollingDate(2),
    expiresAt: rollingExpiry(5),
    impressions: 1560,
    clicks: 41,
    paidZAR: 499,
  },
  {
    id: 'sp-004',
    name: 'CyberVault',
    slot: 'RIGHT_DASHBOARD_RECTANGLE',
    enabled: true,
    size: 'standard',
    tagline: 'Data Security & Backup Solutions',
    websiteUrl: 'https://cybervault-demo.co.za',
    bgColor: '#1e1e2e',
    textColor: '#e2e8f0',
    accentColor: '#4299e1',
    icon: 'lock',
    duration: '7d',
    startedAt: rollingDate(1),
    expiresAt: rollingExpiry(6),
    impressions: 890,
    clicks: 23,
    paidZAR: 499,
  },
  {
    id: 'sp-006',
    name: 'Veld Broadband',
    slot: 'BOTTOM_INTELLIGENCE_LEADERBOARD',
    enabled: true,
    size: 'standard',
    tagline: 'Rural Connectivity — No Dead Zones',
    websiteUrl: 'https://veldbroadband-demo.co.za',
    bgColor: '#1a2332',
    textColor: '#e2e8f0',
    accentColor: '#9f7aea',
    icon: 'web',
    duration: '30d',
    startedAt: rollingDate(5),
    expiresAt: rollingExpiry(25),
    impressions: 6720,
    clicks: 198,
    paidZAR: 1499,
  },
];
