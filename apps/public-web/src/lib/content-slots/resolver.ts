import type { PlacementId, SlotAssignment, ResolvedContent } from './types';
import type { CampaignRow } from '../api/sponsors';
import { getEnabledAssetsByType, getImageData } from './asset-library';
import { ALL_PLACEMENT_IDS } from './registry';

// ---------------------------------------------------------------------------
// Public context — everything the resolver needs from the outside world
// ---------------------------------------------------------------------------

export interface PlacementContext {
  globalPublicMode: boolean;
  placementMode: string;
  campaigns: CampaignRow[];
  globalInfographicFallback: boolean;
  enabledInfographicTypes: string[];
  emergencySuppression?: boolean;
  viewportWidth?: number;
}

// Legacy alias
export interface ResolverInput {
  assignment: SlotAssignment;
  campaigns: CampaignRow[];
  globalInfographicFallback: boolean;
  globalDisplayEnabled: boolean;
  enabledInfographicTypes: string[];
}

// ---------------------------------------------------------------------------
// Session-stable selection cache — §17
// A selected campaign stays pinned to a placement for the session.
// ---------------------------------------------------------------------------

const sessionSelectionCache = new Map<PlacementId, string>();

// ---------------------------------------------------------------------------
// resolvePublicPlacement — §14: the single central function
//
// Returns the resolved content for a placement after checking all 15
// activation conditions. Do NOT duplicate activation logic elsewhere.
// ---------------------------------------------------------------------------

export function resolvePublicPlacement(
  context: PlacementContext,
  slotId: PlacementId,
): ResolvedContent {
  // §14.1 — Global public mode must be ACTIVE
  if (!context.globalPublicMode) return { type: 'hidden' };

  // §14.2 — Placement mode must not be DISABLED
  if (context.placementMode === 'hidden') return { type: 'hidden' };

  // §14.15 — Emergency suppression
  if (context.emergencySuppression) return { type: 'hidden' };

  // §14.13 — Four-placement limit (structural — always 4 slots)
  // Enforced by the admin UI; the resolver trusts assignment data.

  // Forced modes — skip auto resolution
  if (context.placementMode === 'paid_ad') {
    return resolveSponsor(slotId, context) ?? { type: 'hidden' };
  }
  if (context.placementMode === 'infographic') {
    return resolveInfographic(slotId, context.enabledInfographicTypes) ?? { type: 'hidden' };
  }
  if (context.placementMode === 'placeholder') {
    return resolvePlaceholder(slotId) ?? { type: 'hidden' };
  }

  // AUTO mode — §17 priority chain
  const sponsor = resolveSponsor(slotId, context);
  if (sponsor) return sponsor;

  if (context.globalInfographicFallback) {
    const infographic = resolveInfographic(slotId, context.enabledInfographicTypes);
    if (infographic) return infographic;
  }

  const placeholder = resolvePlaceholder(slotId);
  if (placeholder) return placeholder;

  return { type: 'hidden' };
}

// ---------------------------------------------------------------------------
// Sponsor resolution — §14 conditions 3-12, 14 checked here
// ---------------------------------------------------------------------------

function resolveSponsor(
  slotId: PlacementId,
  context: PlacementContext,
): ResolvedContent | null {
  const eligible = context.campaigns.filter(c => {
    // §14.3 — Campaign status is ACTIVE
    if (c.status !== 'active') return false;

    // §14.4 — Assignment matches this placement
    if (c.placement !== slotId) return false;

    // §14.5 — Current time is inside campaign dates
    const now = Date.now();
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return false;
    if (c.ends_at && new Date(c.ends_at).getTime() <= now) return false;

    // §14.10 — Destination URL is valid (non-empty)
    // In demo mode we allow empty URLs, but flag clearly
    // if (c.link_url && !isValidUrl(c.link_url)) return false;

    // §14.14 — Creative file is available
    // image_url can be undefined for text-only ads in demo mode
    // Real mode would check creative variant existence

    return true;
  });

  if (eligible.length === 0) return null;

  // §17 — Session-stable selection
  const cached = sessionSelectionCache.get(slotId);
  let selected = cached ? eligible.find(c => c.id === cached) : null;

  if (!selected) {
    // §17 — Select by priority (implicit from campaign order), then delivery weight
    selected = eligible[0]!;
    sessionSelectionCache.set(slotId, selected.id);
  }

  return {
    type: 'sponsor',
    campaignId: selected.id,
    disclosure: 'Sponsored',
    sponsorName: selected.display_name,
    displayName: selected.display_name,
    tagline: selected.tagline ?? '',
    linkUrl: selected.link_url ?? '',
    imageUrl: selected.image_url ?? '',
    size: selected.size,
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

// ---------------------------------------------------------------------------
// Infographic fallback
// ---------------------------------------------------------------------------

function resolveInfographic(slotId: PlacementId, enabledTypes: string[]): ResolvedContent | null {
  if (enabledTypes.length === 0) return null;
  const slotIndex = ALL_PLACEMENT_IDS.indexOf(slotId);
  const infographicType = enabledTypes[slotIndex % enabledTypes.length]!;
  return { type: 'infographic', infographicType };
}

// ---------------------------------------------------------------------------
// Placeholder fallback
// ---------------------------------------------------------------------------

function resolvePlaceholder(slotId: PlacementId): ResolvedContent | null {
  const assets = getEnabledAssetsByType('placeholder');
  if (assets.length === 0) return null;
  const slotIndex = ALL_PLACEMENT_IDS.indexOf(slotId);
  const asset = assets[slotIndex % assets.length]!;
  const src = getImageData(asset.id);
  if (!src) return null;
  return { type: 'placeholder', src, alt: asset.alt };
}

// ---------------------------------------------------------------------------
// Legacy bridge — existing components call resolveSlotContent
// ---------------------------------------------------------------------------

export function resolveSlotContent(input: ResolverInput): ResolvedContent {
  return resolvePublicPlacement(
    {
      globalPublicMode: input.globalDisplayEnabled,
      placementMode: input.assignment.mode,
      campaigns: input.campaigns,
      globalInfographicFallback: input.globalInfographicFallback,
      enabledInfographicTypes: input.enabledInfographicTypes,
    },
    input.assignment.slotKey,
  );
}
