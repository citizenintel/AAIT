import type { SlotKey, SlotAssignment, ResolvedContent } from './types';
import type { CampaignRow } from '../api/sponsors';
import { getEnabledAssetsByType, getImageData } from './asset-library';

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

  const slotKey = assignment.slotKey;

  if (assignment.mode === 'paid_ad') {
    return resolvePaidAd(slotKey, campaigns) ?? { type: 'hidden' };
  }
  if (assignment.mode === 'infographic') {
    return resolveInfographic(slotKey, enabledInfographicTypes) ?? { type: 'hidden' };
  }
  if (assignment.mode === 'placeholder') {
    return resolvePlaceholder(slotKey) ?? { type: 'hidden' };
  }

  // AUTO mode: priority chain
  const paidAd = resolvePaidAd(slotKey, campaigns);
  if (paidAd) return paidAd;

  if (globalInfographicFallback) {
    const infographic = resolveInfographic(slotKey, enabledInfographicTypes);
    if (infographic) return infographic;
  }

  const placeholder = resolvePlaceholder(slotKey);
  if (placeholder) return placeholder;

  return { type: 'hidden' };
}

function resolvePaidAd(slotKey: SlotKey, campaigns: CampaignRow[]): ResolvedContent | null {
  const campaign = campaigns.find(c => c.placement === slotKey && c.status === 'active');
  if (!campaign) return null;
  return {
    type: 'paid_ad',
    campaignId: campaign.id,
    displayName: campaign.display_name,
    tagline: campaign.tagline ?? '',
    linkUrl: campaign.link_url ?? '',
    imageUrl: campaign.image_url ?? '',
    size: campaign.size,
    icon: 'shield',
    bgColor: '#1a2332',
    textColor: '#e2e8f0',
    accentColor: '#c9a84c',
  };
}

function resolveInfographic(slotKey: SlotKey, enabledTypes: string[]): ResolvedContent | null {
  if (enabledTypes.length === 0) return null;
  const slotIndex = parseInt(slotKey.replace('slot-', '')) - 1;
  const infographicType = enabledTypes[slotIndex % enabledTypes.length]!;
  return { type: 'infographic', infographicType };
}

function resolvePlaceholder(slotKey: SlotKey): ResolvedContent | null {
  const assets = getEnabledAssetsByType('placeholder');
  if (assets.length === 0) return null;
  const slotIndex = parseInt(slotKey.replace('slot-', '')) - 1;
  const asset = assets[slotIndex % assets.length]!;
  const src = getImageData(asset.id);
  if (!src) return null;
  return { type: 'placeholder', src, alt: asset.alt };
}
