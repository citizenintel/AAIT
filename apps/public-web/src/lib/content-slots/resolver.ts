import type { PlacementId, SlotAssignment, ResolvedContent } from './types';
import type { CampaignRow } from '../api/sponsors';
import { getEnabledAssetsByType, getImageData } from './asset-library';
import { ALL_PLACEMENT_IDS } from './registry';

export interface ResolverInput {
  assignment: SlotAssignment;
  campaigns: CampaignRow[];
  globalInfographicFallback: boolean;
  globalDisplayEnabled: boolean;
  enabledInfographicTypes: string[];
}

export function resolveSlotContent(input: ResolverInput): ResolvedContent {
  const { assignment, campaigns, globalInfographicFallback, globalDisplayEnabled, enabledInfographicTypes } = input;

  if (!globalDisplayEnabled) return { type: 'hidden' };
  if (assignment.mode === 'hidden') return { type: 'hidden' };

  const placementId = assignment.slotKey;

  if (assignment.mode === 'paid_ad') {
    return resolvePaidAd(placementId, campaigns) ?? { type: 'hidden' };
  }
  if (assignment.mode === 'infographic') {
    return resolveInfographic(placementId, enabledInfographicTypes) ?? { type: 'hidden' };
  }
  if (assignment.mode === 'placeholder') {
    return resolvePlaceholder(placementId) ?? { type: 'hidden' };
  }

  // AUTO mode: priority chain — §14, §17
  const paidAd = resolvePaidAd(placementId, campaigns);
  if (paidAd) return paidAd;

  if (globalInfographicFallback) {
    const infographic = resolveInfographic(placementId, enabledInfographicTypes);
    if (infographic) return infographic;
  }

  const placeholder = resolvePlaceholder(placementId);
  if (placeholder) return placeholder;

  return { type: 'hidden' };
}

function resolvePaidAd(placementId: PlacementId, campaigns: CampaignRow[]): ResolvedContent | null {
  const campaign = campaigns.find(c => c.placement === placementId && c.status === 'active');
  if (!campaign) return null;
  return {
    type: 'sponsor',
    campaignId: campaign.id,
    disclosure: 'Sponsored',
    sponsorName: campaign.display_name,
    displayName: campaign.display_name,
    tagline: campaign.tagline ?? '',
    linkUrl: campaign.link_url ?? '',
    imageUrl: campaign.image_url ?? '',
    size: campaign.size,
    icon: 'shield',
    bgColor: '#1a2332',
    textColor: '#e2e8f0',
    accentColor: '#c9a84c',
    cta: 'Learn more',
    fitMode: 'cover',
    focalX: 50,
    focalY: 50,
  };
}

function resolveInfographic(placementId: PlacementId, enabledTypes: string[]): ResolvedContent | null {
  if (enabledTypes.length === 0) return null;
  const slotIndex = ALL_PLACEMENT_IDS.indexOf(placementId);
  const infographicType = enabledTypes[slotIndex % enabledTypes.length]!;
  return { type: 'infographic', infographicType };
}

function resolvePlaceholder(placementId: PlacementId): ResolvedContent | null {
  const assets = getEnabledAssetsByType('placeholder');
  if (assets.length === 0) return null;
  const slotIndex = ALL_PLACEMENT_IDS.indexOf(placementId);
  const asset = assets[slotIndex % assets.length]!;
  const src = getImageData(asset.id);
  if (!src) return null;
  return { type: 'placeholder', src, alt: asset.alt };
}
