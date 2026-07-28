import type { PlacementId } from './types';
import { PLACEMENT_REGISTRY } from './registry';

interface TestCreativeSpec {
  number: number;
  placementId: PlacementId;
  sponsorName: string;
  bgColor: string;
  accentColor: string;
}

const SPECS: TestCreativeSpec[] = [
  { number: 1, placementId: 'GLANCE_RAIL_FEATURED', sponsorName: 'FarmWatch Alert', bgColor: '#1a2e1a', accentColor: '#ed8936' },
  { number: 2, placementId: 'LEFT_RAIL_COMPACT', sponsorName: 'AgriShield Insurance', bgColor: '#1a2332', accentColor: '#48bb78' },
  { number: 3, placementId: 'RIGHT_DASHBOARD_RECTANGLE', sponsorName: 'CyberVault', bgColor: '#1e1e2e', accentColor: '#4299e1' },
  { number: 4, placementId: 'BOTTOM_INTELLIGENCE_LEADERBOARD', sponsorName: 'Veld Broadband', bgColor: '#2d1a2e', accentColor: '#9f7aea' },
];

function buildSvg(spec: TestCreativeSpec): string {
  const def = PLACEMENT_REGISTRY.find(p => p.id === spec.placementId)!;
  const w = def.referenceWidth;
  const h = def.referenceHeight;
  const isCompact = h <= 90;
  const numSize = isCompact ? Math.floor(h * 0.55) : Math.floor(Math.min(w, h) * 0.35);
  const labelSize = isCompact ? 11 : 14;
  const dimSize = isCompact ? 8 : 10;

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<defs><linearGradient id="g${spec.number}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="${spec.bgColor}"/>`,
    `<stop offset="100%" stop-color="#0a0f1a"/>`,
    `</linearGradient></defs>`,
    `<rect width="${w}" height="${h}" fill="url(#g${spec.number})" rx="4"/>`,
    `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="${spec.accentColor}" stroke-width="1.5" stroke-dasharray="6 3" rx="3" opacity="0.4"/>`,
  ];

  if (isCompact) {
    const numX = Math.round(w * 0.06);
    const textX = numX + Math.round(numSize * 0.7);
    lines.push(
      `<text x="${numX}" y="${Math.round(h / 2 + numSize * 0.35)}" font-family="system-ui,sans-serif" font-size="${numSize}" font-weight="800" fill="${spec.accentColor}">${spec.number}</text>`,
      `<text x="${textX}" y="${Math.round(h / 2 + 1)}" font-family="system-ui,sans-serif" font-size="${labelSize}" font-weight="700" fill="#e2e8f0" opacity="0.9">${spec.sponsorName}</text>`,
      `<text x="${w - 10}" y="${Math.round(h / 2 + 1)}" text-anchor="end" font-family="system-ui,sans-serif" font-size="${dimSize}" fill="#94a3b8" opacity="0.5">${w}x${h} TEST</text>`,
    );
  } else {
    lines.push(
      `<text x="${w / 2}" y="${Math.round(h * 0.2)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${labelSize}" font-weight="700" fill="#e2e8f0" opacity="0.9">${spec.sponsorName}</text>`,
      `<text x="${w / 2}" y="${Math.round(h / 2 + numSize * 0.15)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${numSize}" font-weight="800" fill="${spec.accentColor}">${spec.number}</text>`,
      `<text x="${w / 2}" y="${h - 16}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${dimSize}" fill="#94a3b8" opacity="0.5">${w}x${h} · TEST ONLY</text>`,
    );
  }

  lines.push('</svg>');
  return lines.join('');
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const TEST_CREATIVE_URIS: Record<PlacementId, string> = Object.fromEntries(
  SPECS.map(s => [s.placementId, svgToDataUri(buildSvg(s))])
) as Record<PlacementId, string>;

export function getTestCreativeUri(placementId: PlacementId): string {
  return TEST_CREATIVE_URIS[placementId];
}

export { SPECS as TEST_CREATIVE_SPECS };
