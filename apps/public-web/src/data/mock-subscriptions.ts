export type BenefitKey =
  | 'print_reports'
  | 'view_analytics'
  | 'view_ait'
  | 'view_unrest'
  | 'view_bias'
  | 'view_infrastructure'
  | 'view_natural'
  | 'premium_breakdowns'
  | 'location_details'
  | 'download_data'
  | 'ai_insights';

export const BENEFITS: { key: BenefitKey; label: string; desc: string; category: 'access' | 'feature' }[] = [
  { key: 'view_ait', label: 'Farm & Rural data (farm attacks, rural crime)', desc: 'View all Farm & Rural module incidents and detail pages', category: 'access' },
  { key: 'view_unrest', label: 'Unrest Watch data', desc: 'View protests, riots, political violence data', category: 'access' },
  { key: 'view_bias', label: 'Bias Monitor data', desc: 'View hate crimes, xenophobia, bias indicators', category: 'access' },
  { key: 'view_infrastructure', label: 'Infrastructure data', desc: 'View electricity, water, telecom failures', category: 'access' },
  { key: 'view_natural', label: 'Natural Events data', desc: 'View fires, floods, droughts', category: 'access' },
  { key: 'location_details', label: 'Location details', desc: 'See exact incident locations, not just province', category: 'access' },
  { key: 'view_analytics', label: 'Analytics dashboards', desc: 'Access category, geographic, and temporal analytics', category: 'feature' },
  { key: 'premium_breakdowns', label: 'Premium breakdowns', desc: 'AI-generated analytical breakdowns for reporting', category: 'feature' },
  { key: 'print_reports', label: 'Print / export reports', desc: 'Generate and download printable incident reports', category: 'feature' },
  { key: 'download_data', label: 'Download data exports', desc: 'Export filtered incident data as CSV', category: 'feature' },
  { key: 'ai_insights', label: 'AI insights', desc: 'AI-powered trend summaries and pattern alerts', category: 'feature' },
];

export type BillingPeriod = 'monthly' | 'yearly';

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: BillingPeriod;
  benefits: BenefitKey[];
  isActive: boolean;
  isFeatured: boolean;
  maxSubscribers: number | null;
  description: string;
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  tierId: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  startDate: string;
  endDate: string;
  paypalTransactionId: string;
  isDemo: boolean;
}

export const MOCK_TIERS: SubscriptionTier[] = [
  {
    id: 'tier-free',
    name: 'Free',
    price: 0,
    currency: 'ZAR',
    period: 'monthly',
    benefits: ['view_ait', 'view_natural'],
    isActive: true,
    isFeatured: false,
    maxSubscribers: null,
    description: 'Basic access to the public map with Farm & Rural and Natural Events data.',
  },
  {
    id: 'tier-basic',
    name: 'Basic',
    price: 49,
    currency: 'ZAR',
    period: 'monthly',
    benefits: ['view_ait', 'view_unrest', 'view_natural', 'view_infrastructure', 'location_details'],
    isActive: true,
    isFeatured: false,
    maxSubscribers: null,
    description: 'Extended data access including unrest and infrastructure incidents with location details.',
  },
  {
    id: 'tier-premium',
    name: 'Premium',
    price: 149,
    currency: 'ZAR',
    period: 'monthly',
    benefits: ['view_ait', 'view_unrest', 'view_bias', 'view_infrastructure', 'view_natural', 'location_details', 'view_analytics', 'premium_breakdowns', 'print_reports'],
    isActive: true,
    isFeatured: true,
    maxSubscribers: null,
    description: 'Full data access with analytics, AI-powered breakdowns, and printable reports.',
  },
  {
    id: 'tier-pro',
    name: 'Professional',
    price: 299,
    currency: 'ZAR',
    period: 'monthly',
    benefits: ['view_ait', 'view_unrest', 'view_bias', 'view_infrastructure', 'view_natural', 'location_details', 'view_analytics', 'premium_breakdowns', 'print_reports', 'download_data', 'ai_insights'],
    isActive: true,
    isFeatured: false,
    maxSubscribers: 50,
    description: 'Everything in Premium plus data exports, AI insights, and priority support. For journalists and researchers.',
  },
];

export const MOCK_SUBSCRIBERS: Subscriber[] = [
  { id: 'sub-001', name: 'Pieter Botha DEMO', email: 'pieter.demo@example.com', tierId: 'tier-premium', status: 'active', startDate: '2026-06-15', endDate: '2026-07-15', paypalTransactionId: 'PP-DEMO-001', isDemo: true },
  { id: 'sub-002', name: 'Sarah Ndlovu DEMO', email: 'sarah.demo@example.com', tierId: 'tier-basic', status: 'active', startDate: '2026-07-01', endDate: '2026-08-01', paypalTransactionId: 'PP-DEMO-002', isDemo: true },
  { id: 'sub-003', name: 'Jan Marais DEMO', email: 'jan.demo@example.com', tierId: 'tier-pro', status: 'active', startDate: '2026-07-10', endDate: '2026-08-10', paypalTransactionId: 'PP-DEMO-003', isDemo: true },
  { id: 'sub-004', name: 'Lindiwe K. DEMO', email: 'lindiwe.demo@example.com', tierId: 'tier-premium', status: 'cancelled', startDate: '2026-05-20', endDate: '2026-06-20', paypalTransactionId: 'PP-DEMO-004', isDemo: true },
  { id: 'sub-005', name: 'Media House DEMO', email: 'media.demo@example.com', tierId: 'tier-pro', status: 'active', startDate: '2026-07-05', endDate: '2026-08-05', paypalTransactionId: 'PP-DEMO-005', isDemo: true },
];
