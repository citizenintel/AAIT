function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function incidentFingerprint(title: string, date: string, location: string): string {
  return `${norm(title)}|${norm(date)}|${norm(location)}`;
}

export function deduplicateByContent<T>(
  items: T[],
  getFingerprint: (item: T) => string,
  getId: (item: T) => string,
): T[] {
  const seenFp = new Map<string, string>();
  const seenId = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const id = getId(item);
    if (seenId.has(id)) continue;
    seenId.add(id);
    const fp = getFingerprint(item);
    if (fp && seenFp.has(fp) && seenFp.get(fp) !== id) continue;
    if (!seenFp.has(fp)) seenFp.set(fp, id);
    result.push(item);
  }
  return result;
}
