import type { PlacementDefinition, PlacementId } from './types';
import { MAX_PUBLIC_PLACEMENTS } from './types';

// §3 — Four stable placement definitions
export const PLACEMENT_REGISTRY: PlacementDefinition[] = [
  {
    id: 'LEFT_RAIL_FEATURED',
    publicLabel: 'Left Rail — Featured Sponsor',
    referenceWidth: 300,
    referenceHeight: 250,
    aspectRatio: '6:5',
    placementGroup: 'left_rail',
    defaultFitMode: 'cover',
  },
  {
    id: 'LEFT_RAIL_COMPACT',
    publicLabel: 'Left Rail — Compact Sponsor',
    referenceWidth: 320,
    referenceHeight: 50,
    aspectRatio: '32:5',
    placementGroup: 'left_rail',
    defaultFitMode: 'contain',
  },
  {
    id: 'RIGHT_RAIL_RECTANGLE',
    publicLabel: 'Right Dashboard — Sponsor',
    referenceWidth: 300,
    referenceHeight: 250,
    aspectRatio: '6:5',
    placementGroup: null,
    defaultFitMode: 'cover',
  },
  {
    id: 'BOTTOM_LEADERBOARD',
    publicLabel: 'Bottom Intelligence Bar — Sponsor',
    referenceWidth: 728,
    referenceHeight: 90,
    aspectRatio: '364:45',
    placementGroup: null,
    defaultFitMode: 'contain',
  },
];

// Legacy alias
export const SLOT_REGISTRY = PLACEMENT_REGISTRY;

export const ALL_PLACEMENT_IDS: PlacementId[] = PLACEMENT_REGISTRY.map(p => p.id);

// Legacy alias
export const ALL_SLOT_KEYS = ALL_PLACEMENT_IDS;

export function getPlacementDefinition(id: PlacementId): PlacementDefinition {
  const def = PLACEMENT_REGISTRY.find(p => p.id === id);
  if (!def) throw new Error(`Unknown placement: ${id}`);
  return def;
}

// Legacy alias
export const getSlotDefinition = getPlacementDefinition;

if (PLACEMENT_REGISTRY.length !== MAX_PUBLIC_PLACEMENTS) {
  throw new Error(`Registry must contain exactly ${MAX_PUBLIC_PLACEMENTS} placements`);
}
