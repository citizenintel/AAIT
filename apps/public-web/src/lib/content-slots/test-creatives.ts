import type { PlacementId } from './types';
import { PLACEMENT_REGISTRY } from './registry';

interface TestCreativeSpec {
  number: number;
  placementId: PlacementId;
  sponsorName: string;
  bgColor: string;
  accentColor: string;
  fixtureColor: string;
}

const SPECS: TestCreativeSpec[] = [
  { number: 1, placementId: 'LEFT_RAIL_HALF_PAGE', sponsorName: 'FarmWatch Alert', bgColor: '#1a2e1a', accentColor: '#ed8936', fixtureColor: '#FFD700' },
  { number: 2, placementId: 'BOTTOM_PRIMARY_BILLBOARD', sponsorName: 'Veld Broadband', bgColor: '#2d1a2e', accentColor: '#9f7aea', fixtureColor: '#FF8C00' },
  { number: 3, placementId: 'BOTTOM_SECONDARY_BILLBOARD', sponsorName: 'AgriShield Insurance', bgColor: '#1a2332', accentColor: '#48bb78', fixtureColor: '#DC143C' },
  { number: 4, placementId: 'RIGHT_RAIL_HALF_PAGE', sponsorName: 'CyberVault', bgColor: '#1e1e2e', accentColor: '#4299e1', fixtureColor: '#00C853' },
];

function buildSvg(spec: TestCreativeSpec): string {
  const def = PLACEMENT_REGISTRY.find(p => p.id === spec.placementId)!;
  const w = def.referenceWidth;
  const h = def.referenceHeight;
  const numSize = Math.floor(Math.min(w, h) * 0.35);
  const labelSize = 14;
  const dimSize = 10;

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="${spec.fixtureColor}"/>`,
    `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2" stroke-dasharray="8 4" rx="4"/>`,
    `<text x="${w / 2}" y="${Math.round(h * 0.25)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${labelSize}" font-weight="700" fill="rgba(0,0,0,0.7)">${spec.sponsorName}</text>`,
    `<text x="${w / 2}" y="${Math.round(h / 2 + numSize * 0.15)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${numSize}" font-weight="800" fill="rgba(0,0,0,0.5)">${spec.number}</text>`,
    `<text x="${w / 2}" y="${h - 16}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${dimSize}" fill="rgba(0,0,0,0.4)">${w}x${h} · TEST FIXTURE</text>`,
    '</svg>',
  ];
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
