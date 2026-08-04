/**
 * Duplicate detection for incident records.
 *
 * Two rules this module exists to enforce:
 *
 *  1. NEVER JUDGE WITHOUT EVIDENCE. A fingerprint built from empty parts is not
 *     a fingerprint, it is a collision magnet. `incidentFingerprint('', '', '')`
 *     used to return the string "||", which is truthy, so every record with no
 *     content, no date and no place collapsed into a single survivor. Since the
 *     importer stopped fabricating dates, `dateOccurred` is legitimately '' for
 *     a large share of a historical import, which made that path live. An
 *     unusable key now returns '' and the caller skips the comparison entirely.
 *
 *  2. NEVER DROP SILENTLY. `deduplicateWithStats` reports exactly how many
 *     records it removed and why, and which id absorbed which. Callers that
 *     publish counts to the user MUST use it — `deduplicateByContent` is the
 *     convenience wrapper for the places that only need the survivors.
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Content key for duplicate detection.
 *
 * Returns '' — meaning "refuse to judge" — when the CONTENT component is empty
 * after normalisation. Date and place alone can never establish that two
 * records describe the same event: an undated, untitled row from a messy source
 * shares "no date, no town" with every other such row, and treating that as a
 * match deletes real records. Callers must treat '' as "not comparable" and
 * keep the record.
 */
export function incidentFingerprint(title: string, date: string, location: string): string {
  const t = norm(title ?? '');
  if (!t) return '';
  return `${t}|${norm(date ?? '')}|${norm(location ?? '')}`;
}

/** The shape every incident-like record shares for fingerprinting purposes. */
export interface FingerprintableIncident {
  summary?: string | null;
  title?: string | null;
  dateOccurred?: string | null;
  town?: string | null;
  province?: string | null;
}

/**
 * THE canonical key for a stored incident. Every layer that can delete a record
 * must use this one function, or the layers disagree about what a duplicate is
 * and a record is refused by one and kept by another.
 *
 * Keyed on summary AND title together, deliberately:
 *
 *  - Title alone (what the store's ingress check used) is too WEAK. Titles are
 *    auto-generated, so two distinct incidents in the same town on the same
 *    (now often empty) date produced one key and the second was refused before
 *    it ever reached storage.
 *  - Summary alone is also too weak here, because incident-splitter.ts:549 and
 *    AdminImport's cleanIncidents stamp a hash of the record's own text into
 *    the TITLE precisely so sibling fragments cannot collide. Dropping the
 *    title from the key throws that guarantee away.
 *
 * The conjunction is strictly more specific than either, so it can only ever
 * merge FEWER records — and under-merging shows the user a visible duplicate
 * they can delete, whereas over-merging deletes evidence. When both content
 * fields are empty the key is '' and the record is never merged with anything:
 * date and place alone cannot establish that two records describe one event,
 * and since the importer stopped fabricating dates an "empty, empty" key is
 * common in a real historical import.
 *
 * `||` rather than `??` on the location: an empty-string town must fall back to
 * the province, or two records in different provinces share a key.
 */
export function mockIncidentFingerprint(i: FingerprintableIncident): string {
  const summary = norm(i.summary || '');
  const title = norm(i.title || '');
  if (!summary && !title) return '';
  return `${summary}|${title}|${norm(i.dateOccurred || '')}|${norm(i.town || i.province || '')}`;
}

/** One record removed because another record carried the same content key. */
export interface MergedRecord {
  droppedId: string;
  keptId: string;
}

export interface DedupeResult<T> {
  /** The survivors, in input order. */
  items: T[];
  /** Removed because another item had the same non-empty content fingerprint. */
  mergedCount: number;
  /** Removed because their id had already been seen (same record listed twice). */
  duplicateIdCount: number;
  /** mergedCount + duplicateIdCount — everything this function took out. */
  removedCount: number;
  /** id pairs for the content merges, for display/audit. */
  merged: MergedRecord[];
}

/**
 * Deduplicate and REPORT. `items.length + removedCount === input.length` always
 * holds, so a caller can never publish a total that quietly omits a merge.
 */
export function deduplicateWithStats<T>(
  items: T[],
  getFingerprint: (item: T) => string,
  getId: (item: T) => string,
): DedupeResult<T> {
  const seenFp = new Map<string, string>();
  const seenId = new Set<string>();
  const result: T[] = [];
  const merged: MergedRecord[] = [];
  let duplicateIdCount = 0;

  for (const item of items) {
    const id = getId(item);
    if (seenId.has(id)) {
      duplicateIdCount++;
      continue;
    }
    seenId.add(id);

    const fp = getFingerprint(item);
    // An empty key is not comparable — see incidentFingerprint. Such a record
    // is always kept and never becomes a match target for anything else.
    if (!fp) {
      result.push(item);
      continue;
    }
    const keptId = seenFp.get(fp);
    if (keptId !== undefined && keptId !== id) {
      merged.push({ droppedId: id, keptId });
      continue;
    }
    if (keptId === undefined) seenFp.set(fp, id);
    result.push(item);
  }

  return {
    items: result,
    mergedCount: merged.length,
    duplicateIdCount,
    removedCount: merged.length + duplicateIdCount,
    merged,
  };
}

/** Survivors only. Use `deduplicateWithStats` anywhere a count is shown. */
export function deduplicateByContent<T>(
  items: T[],
  getFingerprint: (item: T) => string,
  getId: (item: T) => string,
): T[] {
  return deduplicateWithStats(items, getFingerprint, getId).items;
}
