const HERO_KEY = 'aait_hero_config';
const AD_KEY = 'aait_ad_config';
const DATA_PREFIX = 'aait_img_';

export type SlotCategory = 'hero' | 'ad';

export interface SlotImage {
  id: string;
  label: string;
  type: 'builtin' | 'uploaded';
  category: SlotCategory;
  src: string;
  alt: string;
  enabled: boolean;
  order: number;
}

function resolveBase(src: string): string {
  if (src.startsWith('__BASE__')) {
    const base = import.meta.env?.BASE_URL ?? '/';
    return src.replace('__BASE__', base);
  }
  return src;
}

const BUILTIN_HEROES: SlotImage[] = [
  {
    id: 'builtin-farm-svg',
    label: 'AAIT Farm & Rural (SVG)',
    type: 'builtin',
    category: 'hero',
    src: '__BASE__brand/hero-farm.svg',
    alt: 'AAIT Incident Tracker — farm and rural incident monitoring',
    enabled: true,
    order: 0,
  },
  {
    id: 'builtin-command-svg',
    label: 'AAIT Command Center (SVG)',
    type: 'builtin',
    category: 'hero',
    src: '__BASE__brand/hero-command.svg',
    alt: 'AAIT Incident Tracker — command center with SA incident map',
    enabled: true,
    order: 1,
  },
];

function storageKey(cat: SlotCategory): string {
  return cat === 'hero' ? HERO_KEY : AD_KEY;
}

function builtins(cat: SlotCategory): SlotImage[] {
  return cat === 'hero' ? BUILTIN_HEROES : [];
}

export function getConfig(cat: SlotCategory): SlotImage[] {
  const defaults = builtins(cat);
  try {
    const raw = localStorage.getItem(storageKey(cat));
    if (raw) {
      const parsed: SlotImage[] = JSON.parse(raw);
      const builtinIds = new Set(defaults.map(b => b.id));
      const existing = new Set(parsed.map(p => p.id));
      for (const b of defaults) {
        if (!existing.has(b.id)) parsed.push({ ...b });
      }
      return parsed.map(h => {
        if (builtinIds.has(h.id)) {
          const builtin = defaults.find(b => b.id === h.id)!;
          return { ...builtin, enabled: h.enabled, order: h.order };
        }
        return h;
      }).sort((a, b) => a.order - b.order);
    }
  } catch { /* ignore */ }
  return defaults.map(h => ({ ...h }));
}

export function saveConfig(cat: SlotCategory, images: SlotImage[]): void {
  localStorage.setItem(storageKey(cat), JSON.stringify(images));
}

export function getActiveImages(cat: SlotCategory): { src: string; alt: string }[] {
  const config = getConfig(cat);
  const active = config
    .filter(h => h.enabled)
    .sort((a, b) => a.order - b.order)
    .map(h => ({
      src: h.type === 'uploaded' ? getImageData(h.id) ?? '' : resolveBase(h.src),
      alt: h.alt,
    }))
    .filter(h => h.src);
  if (active.length === 0 && cat === 'hero') {
    return BUILTIN_HEROES.map(h => ({ src: resolveBase(h.src), alt: h.alt }));
  }
  return active;
}

export function uploadImage(file: File, cat: SlotCategory): Promise<SlotImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error('Image must be under 5 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      const id = `${cat}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const label = file.name.replace(/\.[^.]+$/, '');

      try {
        localStorage.setItem(DATA_PREFIX + id, dataUri);
      } catch {
        reject(new Error('Storage full — remove some images first'));
        return;
      }

      const config = getConfig(cat);
      const maxOrder = config.reduce((m, h) => Math.max(m, h.order), -1);
      const img: SlotImage = {
        id,
        label,
        type: 'uploaded',
        category: cat,
        src: '',
        alt: label,
        enabled: true,
        order: maxOrder + 1,
      };
      config.push(img);
      saveConfig(cat, config);
      resolve(img);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function getImageData(id: string): string | null {
  return localStorage.getItem(DATA_PREFIX + id);
}

export function removeImage(id: string, cat: SlotCategory): void {
  localStorage.removeItem(DATA_PREFIX + id);
  const config = getConfig(cat).filter(h => h.id !== id);
  saveConfig(cat, config);
}

export function getThumbnail(img: SlotImage): string {
  if (img.type === 'uploaded') return getImageData(img.id) ?? '';
  return resolveBase(img.src);
}

export function getStorageUsage(): { used: number; items: number } {
  let used = 0;
  let items = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DATA_PREFIX) || key === HERO_KEY || key === AD_KEY) {
      used += (localStorage.getItem(key) ?? '').length * 2;
      items++;
    }
  }
  return { used, items };
}
