import type { SlotDefinition, SlotKey } from './types';
import { MAX_PUBLIC_CONTENT_SLOTS } from './types';

export const SLOT_REGISTRY: SlotDefinition[] = [
  {
    key: 'slot-1',
    label: 'Dashboard A',
    location: 'Right panel — after 2nd widget',
    aspectRatio: 'fluid',
    maxWidth: 320,
    maxHeight: 200,
    fitMode: 'cover',
  },
  {
    key: 'slot-2',
    label: 'Sidebar Premium',
    location: 'Sidebar — below infographic breakdown',
    aspectRatio: 'fluid',
    maxWidth: 280,
    maxHeight: 200,
    fitMode: 'cover',
  },
  {
    key: 'slot-3',
    label: 'Sidebar B',
    location: 'Sidebar — below 24-hour summary',
    aspectRatio: 'fluid',
    maxWidth: 280,
    maxHeight: 200,
    fitMode: 'cover',
  },
  {
    key: 'slot-4',
    label: 'Dashboard B',
    location: 'Right panel — after 4th widget',
    aspectRatio: 'fluid',
    maxWidth: 320,
    maxHeight: 200,
    fitMode: 'cover',
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
