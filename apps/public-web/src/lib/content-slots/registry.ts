import type { PlacementDefinition, PlacementId } from './types';
import { MAX_PUBLIC_PLACEMENTS } from './types';

export const PLACEMENT_REGISTRY: PlacementDefinition[] = [
  {
    id: 'LEFT_RAIL_HALF_PAGE',
    publicLabel: 'Left Rail — Large Vertical Sponsor',
    referenceWidth: 300,
    referenceHeight: 600,
    aspectRatio: '1:2',
    placementGroup: 'left_rail',
    defaultFitMode: 'cover',
  },
  {
    id: 'BOTTOM_PRIMARY_BILLBOARD',
    publicLabel: 'Bottom Bar — Primary Billboard',
    referenceWidth: 970,
    referenceHeight: 250,
    aspectRatio: '97:25',
    placementGroup: 'bottom',
    defaultFitMode: 'cover',
  },
  {
    id: 'BOTTOM_SECONDARY_BILLBOARD',
    publicLabel: 'Bottom Bar — Secondary Billboard',
    referenceWidth: 728,
    referenceHeight: 250,
    aspectRatio: '364:125',
    placementGroup: 'bottom',
    defaultFitMode: 'cover',
  },
  {
    id: 'RIGHT_RAIL_HALF_PAGE',
    publicLabel: 'Right Rail — Large Vertical Sponsor',
    referenceWidth: 300,
    referenceHeight: 600,
    aspectRatio: '1:2',
    placementGroup: 'right_rail',
    defaultFitMode: 'cover',
  },
];

export const SLOT_REGISTRY = PLACEMENT_REGISTRY;

export const ALL_PLACEMENT_IDS: PlacementId[] = PLACEMENT_REGISTRY.map(p => p.id);

export const ALL_SLOT_KEYS = ALL_PLACEMENT_IDS;

export function getPlacementDefinition(id: PlacementId): PlacementDefinition {
  const def = PLACEMENT_REGISTRY.find(p => p.id === id);
  if (!def) throw new Error(`Unknown placement: ${id}`);
  return def;
}

export const getSlotDefinition = getPlacementDefinition;

export function getAspectRatioCss(id: PlacementId): string {
  const def = getPlacementDefinition(id);
  const [w, h] = def.aspectRatio.split(':').map(Number);
  return `${w} / ${h}`;
}

if (PLACEMENT_REGISTRY.length !== MAX_PUBLIC_PLACEMENTS) {
  throw new Error(`Registry must contain exactly ${MAX_PUBLIC_PLACEMENTS} placements`);
}
