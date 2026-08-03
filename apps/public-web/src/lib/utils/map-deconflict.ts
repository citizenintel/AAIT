const CELL_SIZE = 0.04;
const GOLDEN_ANGLE = 2.399963;

interface ResolvedCoord {
  id: string;
  lat: number;
  lng: number;
}

export function deconflictCoordinates(
  resolved: ResolvedCoord[],
): Map<string, { lat: number; lng: number }> {
  const result = new Map<string, { lat: number; lng: number }>();
  if (resolved.length === 0) return result;

  const groups = new Map<string, ResolvedCoord[]>();
  for (const rc of resolved) {
    const cellLat = Math.round(rc.lat / CELL_SIZE) * CELL_SIZE;
    const cellLng = Math.round(rc.lng / CELL_SIZE) * CELL_SIZE;
    const key = `${cellLat.toFixed(3)}_${cellLng.toFixed(3)}`;
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(rc);
  }

  for (const [, group] of groups) {
    if (group.length === 1) {
      const first = group[0]!;
      result.set(first.id, { lat: first.lat, lng: first.lng });
      continue;
    }

    const centerLat = group.reduce((s, g) => s + g.lat, 0) / group.length;
    const centerLng = group.reduce((s, g) => s + g.lng, 0) / group.length;

    const maxRadius = Math.min(0.06 + 0.02 * Math.sqrt(group.length), 0.35);

    for (let i = 0; i < group.length; i++) {
      const entry = group[i]!;
      const angle = i * GOLDEN_ANGLE;
      const r = maxRadius * Math.sqrt((i + 1) / group.length);
      result.set(entry.id, {
        lat: centerLat + r * Math.cos(angle),
        lng: centerLng + r * Math.sin(angle),
      });
    }
  }

  return result;
}
