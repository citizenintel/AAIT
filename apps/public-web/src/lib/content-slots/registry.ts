import type { SlotDefinition, SlotKey } from './types';
import { MAX_PUBLIC_CONTENT_SLOTS } from './types';

export const SLOT_REGISTRY: SlotDefinition[] = [
  {
    key: 'layers_featured',
    label: 'Layers Panel · Featured',
    location: 'Inside the Layers panel — large featured position',
    aspectRatio: '4:3',
    maxWidth: 340,
    maxHeight: 280,
    fitMode: 'contain',
  },
  {
    key: 'layers_footer',
    label: 'Layers Panel · Footer',
    location: 'Bottom of the Layers panel — compact card',
    aspectRatio: '3:1',
    maxWidth: 340,
    maxHeight: 120,
    fitMode: 'contain',
  },
  {
    key: 'right_dashboard_sponsor',
    label: 'Right Dashboard · Sponsor',
    location: 'Right dashboard column — below province chart',
    aspectRatio: '16:9',
    maxWidth: 260,
    maxHeight: 160,
    fitMode: 'contain',
  },
  {
    key: 'bottom_intelligence_left',
    label: 'Bottom Bar · Left',
    location: 'Bottom intelligence bar — wide horizontal banner',
    aspectRatio: '5:1',
    maxWidth: 500,
    maxHeight: 160,
    fitMode: 'contain',
  },
];

export const ALL_SLOT_KEYS: SlotKey[] = SLOT_REGISTRY.map(s => s.key);

export function getSlotDefinition(key: SlotKey): SlotDefinition {
  const def = SLOT_REGISTRY.find(s => s.key === key);
  if (!def) throw new Error(`Unknown slot: ${key}`);
  return def;
}

if (SLOT_REGISTRY.length !== MAX_PUBLIC_CONTENT_SLOTS) {
  throw new Error(`Registry must contain exactly ${MAX_PUBLIC_CONTENT_SLOTS} slots`);
}
