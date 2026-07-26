export type AdDuration = '24h' | '48h' | '7d' | '30d' | 'custom';

export interface SponsorAd {
  id: string;
  name: string;
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  enabled: boolean;
  size: 'premium' | 'banner' | 'standard' | 'compact';
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
  banner: 2,
  standard: 1,
  compact: 0.5,
};

export const SLOT_LABELS: Record<number, string> = {
  1: 'Dashboard A',
  2: 'Sidebar Premium',
  3: 'Sidebar B',
  4: 'Dashboard B',
  5: 'Bottom Banner L',
  6: 'Bottom Banner R',
};

function rollingDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}
function rollingExpiry(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString();
}

export const MOCK_SPONSOR_ADS: SponsorAd[] = [
  {
    id: 'sp-001',
    name: 'SecureGuard SA',
    slot: 1,
    enabled: true,
    size: 'standard',
    tagline: '24/7 Farm & Rural Security',
    description: 'Rapid response, perimeter monitoring and armed patrols for farms and smallholdings across South Africa.',
    websiteUrl: 'https://secureguard-demo.co.za',
    bgColor: '#1a2332',
    textColor: '#e2e8f0',
    accentColor: '#e53e3e',
    icon: 'shield',
    duration: '7d',
    startedAt: rollingDate(3),
    expiresAt: rollingExpiry(4),
    impressions: 3420,
    clicks: 87,
    paidZAR: 499,
  },
  {
    id: 'sp-005',
    name: 'FarmWatch Alert',
    slot: 2,
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
    slot: 3,
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
    slot: 4,
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
    id: 'sp-002',
    name: 'Praxcil',
    slot: 5,
    enabled: true,
    size: 'banner',
    tagline: 'This site was designed by Praxcil',
    websiteUrl: 'https://praxcil.com',
    bgColor: '#1a1a2e',
    textColor: '#e2e8f0',
    accentColor: '#c9a84c',
    icon: 'web',
    duration: '30d',
    startedAt: rollingDate(20),
    expiresAt: rollingExpiry(10),
    impressions: 12800,
    clicks: 342,
    paidZAR: 2998,
  },
  {
    id: 'sp-006',
    name: 'SafeRoute SA',
    slot: 6,
    enabled: true,
    size: 'premium',
    tagline: 'Navigate safely — live incident-aware routing for South Africa',
    websiteUrl: 'https://saferoute-demo.co.za',
    bgColor: '#1e2a1e',
    textColor: '#e2e8f0',
    accentColor: '#68d391',
    icon: 'lock',
    duration: '30d',
    startedAt: rollingDate(20),
    expiresAt: rollingExpiry(10),
    impressions: 5400,
    clicks: 156,
    paidZAR: 2998,
  },
];
