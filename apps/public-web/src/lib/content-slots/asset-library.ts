import type { ContentAsset, ContentType } from './types';

const ASSETS_KEY = 'aait_content_assets';
const DATA_PREFIX = 'aait_img_';

export function getAssets(): ContentAsset[] {
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveAssets(assets: ContentAsset[]): void {
  localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
}

export function getAssetsByType(type: ContentType): ContentAsset[] {
  return getAssets()
    .filter(a => a.contentType === type)
    .sort((a, b) => a.order - b.order);
}

export function getEnabledAssetsByType(type: ContentType): ContentAsset[] {
  return getAssetsByType(type).filter(a => a.enabled);
}

export function getImageData(id: string): string | null {
  return localStorage.getItem(DATA_PREFIX + id);
}

export function uploadAsset(file: File, contentType: ContentType): Promise<ContentAsset> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image must be under 5 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      const id = `${contentType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        localStorage.setItem(DATA_PREFIX + id, dataUri);
      } catch {
        reject(new Error('Storage full — remove some images first'));
        return;
      }
      const assets = getAssets();
      const maxOrder = assets.reduce((m, a) => Math.max(m, a.order), -1);
      const asset: ContentAsset = {
        id,
        label: file.name.replace(/\.[^.]+$/, ''),
        contentType,
        src: '',
        alt: file.name.replace(/\.[^.]+$/, ''),
        enabled: true,
        order: maxOrder + 1,
        uploadedAt: new Date().toISOString(),
      };
      assets.push(asset);
      saveAssets(assets);
      resolve(asset);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function removeAsset(id: string): void {
  localStorage.removeItem(DATA_PREFIX + id);
  const assets = getAssets().filter(a => a.id !== id);
  saveAssets(assets);
}

export function toggleAsset(id: string, enabled: boolean): void {
  const assets = getAssets();
  const asset = assets.find(a => a.id === id);
  if (asset) {
    asset.enabled = enabled;
    saveAssets(assets);
  }
}

export function getStorageUsage(): { used: number; items: number } {
  let used = 0;
  let items = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DATA_PREFIX) || key === ASSETS_KEY) {
      used += (localStorage.getItem(key) ?? '').length * 2;
      items++;
    }
  }
  return { used, items };
}

export function migrateFromLegacy(): void {
  const existing = getAssets();
  if (existing.length > 0) return;

  const migrated: ContentAsset[] = [];
  const legacyHeroKey = 'aait_hero_config';
  const legacyAdKey = 'aait_ad_config';

  for (const key of [legacyHeroKey, legacyAdKey]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const items = JSON.parse(raw) as Array<{
        id: string; label: string; alt: string; enabled: boolean; order: number;
      }>;
      for (const item of items) {
        const dataUri = localStorage.getItem(DATA_PREFIX + item.id);
        if (!dataUri) continue;
        migrated.push({
          id: item.id,
          label: item.label,
          contentType: 'placeholder',
          src: '',
          alt: item.alt,
          enabled: item.enabled,
          order: item.order,
          uploadedAt: new Date().toISOString(),
        });
      }
    } catch { /* skip corrupt data */ }
  }

  if (migrated.length > 0) {
    saveAssets(migrated);
  }
}
