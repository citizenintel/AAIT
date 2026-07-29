import type { PlacementId, FitMode, CreativeVariant } from './types';
import { getPlacementDefinition } from './registry';

// ---------------------------------------------------------------------------
// §8-9: Browser-side creative variant processor
//
// No Sharp server exists — all image processing runs client-side via canvas.
// Given a source image (File, Blob, or data URI), this module produces
// placement-specific variants at the exact reference dimensions.
// ---------------------------------------------------------------------------

export interface VariantSpec {
  placementId: PlacementId;
  fitMode: FitMode;
  focalX: number;
  focalY: number;
  backgroundColor: string;
}

export interface ProcessedVariant {
  placementId: PlacementId;
  dataUri: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
}

// ---------------------------------------------------------------------------
// Load an image from various sources
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export async function imageFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Core processing — draws source onto a canvas at target dimensions
// ---------------------------------------------------------------------------

function processVariant(
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  spec: VariantSpec,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = spec.backgroundColor || '#000000';
  ctx.fillRect(0, 0, targetW, targetH);

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  if (spec.fitMode === 'contain') {
    const scale = Math.min(targetW / srcW, targetH / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const offsetX = (targetW - drawW) / 2;
    const offsetY = (targetH - drawH) / 2;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } else if (spec.fitMode === 'manual-crop') {
    const focalXPx = (spec.focalX / 100) * srcW;
    const focalYPx = (spec.focalY / 100) * srcH;
    const scale = Math.max(targetW / srcW, targetH / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    let offsetX = targetW / 2 - focalXPx * scale;
    let offsetY = targetH / 2 - focalYPx * scale;
    offsetX = Math.min(0, Math.max(targetW - drawW, offsetX));
    offsetY = Math.min(0, Math.max(targetH - drawH, offsetY));
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } else {
    // 'cover' and 'adaptive' — cover with focal point awareness
    const focalXPx = (spec.focalX / 100) * srcW;
    const focalYPx = (spec.focalY / 100) * srcH;
    const scale = Math.max(targetW / srcW, targetH / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    let offsetX = targetW / 2 - focalXPx * scale;
    let offsetY = targetH / 2 - focalYPx * scale;
    offsetX = Math.min(0, Math.max(targetW - drawW, offsetX));
    offsetY = Math.min(0, Math.max(targetH - drawH, offsetY));
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  }

  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateVariant(
  sourceDataUri: string,
  spec: VariantSpec,
): Promise<ProcessedVariant> {
  const img = await loadImage(sourceDataUri);
  const def = getPlacementDefinition(spec.placementId);
  const dataUri = processVariant(img, def.referenceWidth, def.referenceHeight, spec);

  const byteString = atob(dataUri.split(',')[1]!);
  const fileSize = byteString.length;

  return {
    placementId: spec.placementId,
    dataUri,
    width: def.referenceWidth,
    height: def.referenceHeight,
    mimeType: 'image/png',
    fileSize,
  };
}

export async function generateAllVariants(
  sourceDataUri: string,
  fitMode: FitMode = 'cover',
  focalX = 50,
  focalY = 50,
  backgroundColor = '#000000',
): Promise<ProcessedVariant[]> {
  const placements: PlacementId[] = [
    'LEFT_RAIL_HALF_PAGE',
    'BOTTOM_PRIMARY_BILLBOARD',
    'BOTTOM_SECONDARY_BILLBOARD',
    'RIGHT_RAIL_HALF_PAGE',
  ];

  const results = await Promise.all(
    placements.map(placementId =>
      generateVariant(sourceDataUri, { placementId, fitMode, focalX, focalY, backgroundColor })
    ),
  );

  return results;
}

export function toCreativeVariant(
  processed: ProcessedVariant,
  creativeId: string,
): CreativeVariant {
  return {
    id: `var-${creativeId}-${processed.placementId}`,
    creativeId,
    placementFormat: processed.placementId,
    fileUrl: processed.dataUri,
    width: processed.width,
    height: processed.height,
    mimeType: processed.mimeType,
    fileSize: processed.fileSize,
    status: 'READY',
    createdAt: new Date().toISOString(),
  };
}
