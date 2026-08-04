import type { MockIncident } from '@/data/mock-incidents';

// ---------------------------------------------------------------------------
// Guardrails (exported so tests and the import UI can read the same numbers)
// ---------------------------------------------------------------------------

/**
 * An entry shorter than this cannot carry date + actor + place; it is a fragment
 * of its neighbour, not a separately-recordable incident.
 * Calibrated against the project fixtures: shortest legitimate single record is
 * 56 chars ("PRETORIUS Hannes. Shot. Kosterfontein farm. 14 Apr 2004."), typical
 * 60-90; the corrupt fragments the old date-anchored strategy produced were 28.
 */
export const MIN_ENTRY_CHARS = 40;

/**
 * Max distinct incidents auto-extracted from ONE source row. A cell holding more
 * than this is a document dump requiring human triage, not a data row. Excess is
 * kept as a single overflow record — never discarded.
 */
export const MAX_SPLIT_FACTOR = 10;

/**
 * Whole-batch fan-out above which the caller must refuse and show a plan.
 * A legitimate multi-incident sheet does not triple.
 */
export const MAX_BATCH_FACTOR = 3;

// ---------------------------------------------------------------------------
// Stable hashing (FNV-1a 32-bit, base36) — synchronous, deterministic, no deps.
// crypto.subtle is async and this runs inside a render-blocking click handler.
// ---------------------------------------------------------------------------

export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/**
 * Whitespace-insensitive canonical form. Load-bearing for identity: newline vs
 * space must never change the key, because rejoining entries is exactly what
 * varies between generations of the same content.
 */
export function canonicalText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// OCR text cleanup
// ---------------------------------------------------------------------------

function cleanOcrText(text: string): string {
  // Fix split years: "200 4" → "2004", "199 8" → "1998"
  return text.replace(/\b((?:19|20)\d)\s(\d)\b/g, '$1$2');
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01', januarie: '01',
  feb: '02', february: '02', februarie: '02',
  mar: '03', march: '03', maa: '03', maart: '03',
  apr: '04', april: '04',
  may: '05', mei: '05',
  jun: '06', june: '06', junie: '06',
  jul: '07', july: '07', julie: '07',
  aug: '08', august: '08', augustus: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10', oktober: '10',
  nov: '11', november: '11',
  dec: '12', december: '12', desember: '12',
};

const DATE_RE_DMY_WORD =
  /(\d{1,2})\s+(jan(?:uary|uarie)?|feb(?:ruary|ruarie)?|mar(?:ch)?|maart|apr(?:il)?|may|mei|jun(?:e|ie)?|jul(?:y|ie)?|aug(?:ust(?:us)?)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?|des(?:ember)?)\s+(\d{4})/gi;

const DATE_RE_MONTH_YEAR =
  /\b(jan(?:uary|uarie)?|feb(?:ruary|ruarie)?|mar(?:ch)?|maart|apr(?:il)?|may|mei|jun(?:e|ie)?|jul(?:y|ie)?|aug(?:ust(?:us)?)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?|des(?:ember)?)\s+(\d{4})\b/gi;

const DATE_RE_YMD = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g;
const DATE_RE_DMY = /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/g;

function normalizeDateMatch(match: RegExpMatchArray, type: 'word' | 'ymd' | 'dmy'): string | null {
  if (type === 'word') {
    const fullKey = match[2]!.toLowerCase();
    const mm = MONTH_MAP[fullKey] ?? MONTH_MAP[fullKey.slice(0, 3)];
    if (!mm) return null;
    return `${match[3]}-${mm}-${match[1]!.padStart(2, '0')}`;
  }
  if (type === 'ymd') {
    return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`;
  }
  let year = match[3]!;
  if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  return `${year}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
}

function extractAllDates(text: string): { date: string; index: number }[] {
  const results: { date: string; index: number }[] = [];
  const seen = new Set<number>();

  for (const m of text.matchAll(DATE_RE_DMY_WORD)) {
    const d = normalizeDateMatch(m, 'word');
    if (d && !seen.has(m.index!)) { results.push({ date: d, index: m.index! }); seen.add(m.index!); }
  }
  for (const m of text.matchAll(DATE_RE_YMD)) {
    const d = normalizeDateMatch(m, 'ymd');
    if (d && !seen.has(m.index!)) { results.push({ date: d, index: m.index! }); seen.add(m.index!); }
  }
  for (const m of text.matchAll(DATE_RE_DMY)) {
    if (seen.has(m.index!)) continue;
    const d = normalizeDateMatch(m, 'dmy');
    if (d) { results.push({ date: d, index: m.index! }); seen.add(m.index!); }
  }

  // Month Year (no day): "July 2004", "Mar 2004" → YYYY-MM-01
  for (const m of text.matchAll(DATE_RE_MONTH_YEAR)) {
    const idx = m.index!;
    let overlaps = false;
    for (const s of seen) {
      if (Math.abs(idx - s) < 20) { overlaps = true; break; }
    }
    if (overlaps) continue;
    const fullKey = m[1]!.toLowerCase();
    const mm = MONTH_MAP[fullKey] ?? MONTH_MAP[fullKey.slice(0, 3)];
    if (mm) {
      results.push({ date: `${m[2]}-${mm}-01`, index: idx });
      seen.add(idx);
    }
  }

  return results.sort((a, b) => a.index - b.index);
}

function extractFirstDate(text: string): string | null {
  const dates = extractAllDates(text);
  return dates.length > 0 ? dates[0]!.date : null;
}

// ---------------------------------------------------------------------------
// Name extraction — redaction-respecting, place/organisation aware
// ---------------------------------------------------------------------------

const NOT_A_NAME = new Set([
  'the', 'and', 'was', 'were', 'has', 'had', 'been', 'not', 'but',
  'for', 'with', 'from', 'that', 'this', 'have', 'are', 'his', 'her',
  'farm', 'attack', 'murder', 'killed', 'shot', 'near', 'area',
  'district', 'province', 'police', 'saps', 'case', 'court',
  'south', 'north', 'east', 'west', 'january', 'february', 'march',
  'april', 'june', 'july', 'august', 'september', 'october',
  'november', 'december', 'unknown', 'imported', 'incident',
  'murdered', 'stabbed', 'assaulted', 'attacked', 'robbed',
  'raped', 'kidnapped', 'missing', 'found', 'arrested', 'died',
  'convicted', 'sentenced', 'acquitted', 'critical', 'high',
  'name', 'withheld',
  // E2: place / direction / role words that were emitted as victim names
  'western', 'eastern', 'northern', 'southern', 'free', 'kwazulu',
  'gauteng', 'limpopo', 'mpumalanga', 'natal', 'cape', 'state',
  'accused', 'suspect', 'victim', 'deceased', 'complainant', 'witness',
]);

/** A candidate whose FULL text matches is never a person. */
const NOT_A_PERSON_PHRASE = new Set([
  'western cape', 'eastern cape', 'northern cape', 'free state',
  'north west', 'kwazulu natal', 'kwazulu-natal', 'south africa',
  'high court', 'magistrates court', 'supreme court',
]);

/** Acronyms that Pattern 2 previously title-cased into fabricated surnames. */
const NOT_A_SURNAME_ACRONYM = new Set([
  'saps', 'anc', 'npa', 'eff', 'da', 'kzn', 'dna', 'cctv', 'sabc',
  'ngo', 'sanral', 'nsri', 'ipid', 'hawks', 'sars', 'satu', 'tlu',
  'afriforum', 'sapa', 'ppe', 'cas', 'mas', 'gps', 'suv', 'atm',
]);

const REDACTION_RE = /\[(?:name|contact|email|case ref)\s+withheld\]/i;

function extractNames(text: string): string[] {
  // E2 (BLOCKER): never harvest a name out of text the import redactor
  // deliberately withheld. Un-redaction is worse than a missing name.
  if (REDACTION_RE.test(text)) return [];

  const names: string[] = [];
  const seen = new Set<string>();

  const accept = (candidate: string) => {
    const lower = candidate.toLowerCase();
    if (NOT_A_PERSON_PHRASE.has(lower)) return;
    // Check EVERY token, not just the first — that is why "Western Cape" passed.
    if (candidate.split(/\s+/).some(t => NOT_A_NAME.has(t.toLowerCase()))) return;
    if (!seen.has(lower)) { names.push(candidate); seen.add(lower); }
  };

  // Pattern 1: standard mixed-case: "Jan van Niekerk", "Marie du Plessis", "Pieter Botha".
  // The particle group must NOT consume the following whitespace — the original
  // `(?:\s+(?:van|de|...)\s+)?` swallowed the separator and then still demanded
  // `\s+[A-Z]`, so no Afrikaans particle name ever matched. Every "van"/"du"/"de"
  // surname in this dataset was silently unextractable.
  const re = /\b([A-Z][a-z]{1,}(?:\s+(?:van|de|du|le|von|la|den|der|het|ten|ter|op|die))*(?:\s+[A-Z][a-z]{1,})+)\b/g;
  for (const m of text.matchAll(re)) {
    const name = m[1]!;
    if (name.split(/\s+/).length > 5) continue;
    accept(name);
  }

  // Pattern 2: ALL-CAPS surname + mixed-case first name: "MOSTERT Susan"
  const capsRe = /\b([A-Z]{2,})\s+([A-Z][a-z]{1,})\b/g;
  for (const m of text.matchAll(capsRe)) {
    const surname = m[1]!;
    const firstName = m[2]!;
    if (NOT_A_SURNAME_ACRONYM.has(surname.toLowerCase())) continue;
    accept(surname.charAt(0) + surname.slice(1).toLowerCase() + ' ' + firstName);
  }

  // E2 (BLOCKER): Pattern 3 — the ALL-CAPS surname sitting immediately before
  // "[name withheld]" — is DELETED. It existed only to recover what the
  // redactor removed.

  return names;
}

// ---------------------------------------------------------------------------
// Location extraction — known towns only
// ---------------------------------------------------------------------------

function extractLocation(text: string, knownTowns: string[]): string | null {
  const lower = text.toLowerCase();
  for (const town of knownTowns) {
    if (lower.includes(town.toLowerCase())) return town;
  }
  // B4: the "any capitalised sentence fragment is a location" fallback is gone.
  // It manufactured extra group keys (inflating the split) and fed garbage to
  // the geocoder as a town name. Unresolved location stays null; the caller
  // inherits the parent town and flags it as inferred.
  return null;
}

// ---------------------------------------------------------------------------
// Entry splitting — structural strategies only, evidence-gated
// ---------------------------------------------------------------------------

export type SplitStrategy =
  | 'none' | 'surname-start' | 'numbered' | 'bullet' | 'newline' | 'semicolon';

export interface SplitPlan {
  entries: string[];
  strategy: SplitStrategy;
  /** True when the source row exceeded MAX_SPLIT_FACTOR and the tail was folded. */
  capped: boolean;
  /** Chunks that failed the evidence gate and were merged into a neighbour. */
  mergedFragments: number;
}

/**
 * Trim, drop empties, and fold any chunk shorter than `min` into its predecessor
 * (or, for a leading short chunk, keep it so its successor can absorb it later).
 *
 * The previous implementation used `.filter(l => l.length > 10)`, which DELETED
 * short continuation lines outright — an OCR wrap such as a bare "Junie 2004"
 * or a trailing "Later." vanished from the record. No source text may be lost.
 */
function foldShortChunks(raw: string[], min: number): string[] {
  const out: string[] = [];
  for (const piece of raw) {
    const t = piece.trim();
    if (!t) continue;
    if (t.length > min || out.length === 0) out.push(t);
    else out[out.length - 1] += ' ' + t;
  }
  return out;
}

function structuralSplit(cleaned: string): { chunks: string[]; strategy: SplitStrategy } {
  // Strategy 0: ALL-CAPS surname at line start
  // "MOSTERT Susan. Murdered. Witkoppies farm. 16 June 2004"
  const SURNAME_START = /^[A-Z]{2,}/;
  const rawLines = cleaned.split(/\n/);
  if (rawLines.length >= 2) {
    const nonEmpty = rawLines.filter(l => l.trim().length > 0);
    const surnameLines = nonEmpty.filter(l => SURNAME_START.test(l.trim()));
    if (surnameLines.length >= 2 && surnameLines.length >= nonEmpty.length * 0.3) {
      const entries: string[] = [];
      let current = '';
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (SURNAME_START.test(trimmed) && current) {
          entries.push(current.trim());
          current = trimmed;
        } else {
          current += (current ? ' ' : '') + trimmed;
        }
      }
      if (current.trim()) entries.push(current.trim());
      if (entries.length >= 2) return { chunks: entries, strategy: 'surname-start' };
    }
  }

  // Strategy 1: numbered entries (1. 2. 3. or 1) 2) 3))
  const numbered = cleaned.split(/\n\s*(?=\d+[\.\)]\s)/);
  if (numbered.length >= 2 && numbered.every(c => c.trim().length > 5)) {
    // A1(3): flatten internal newlines. S1/S2 split only at newline-then-marker
    // boundaries, so a chunk could retain internal newlines and be re-split by
    // an EARLIER strategy on a later pass — the one path around the
    // groupMap.size <= 1 brake.
    return { chunks: numbered.map(c => c.replace(/\s+/g, ' ').trim()), strategy: 'numbered' };
  }

  // Strategy 2: bullet points
  const bullets = cleaned.split(/\n\s*(?=[-•▪]\s)/);
  if (bullets.length >= 2 && bullets.every(c => c.trim().length > 5)) {
    return { chunks: bullets.map(c => c.replace(/\s+/g, ' ').trim()), strategy: 'bullet' };
  }

  // Strategy 3: one record per line
  const lines = foldShortChunks(cleaned.split(/\n+/), 10);
  if (lines.length >= 2) {
    const datesInLines = lines.filter(l => extractAllDates(l).length > 0).length;
    if (datesInLines >= 2) return { chunks: lines, strategy: 'newline' };
  }

  // Strategy 4: semicolon-separated.
  // The split must KEEP its delimiters. `split(/;\s*/)` consumed them, so the
  // child summaries were not byte-recoverable from the source text and the
  // snapshot export stopped being a faithful audit trail. Capturing the ';'
  // and re-attaching it to the chunk it terminated preserves every character.
  const semiParts = cleaned.split(/(;)\s*/);
  const semiRaw: string[] = [];
  for (let i = 0; i < semiParts.length; i += 2) {
    const body = semiParts[i] ?? '';
    const delim = semiParts[i + 1] ?? '';
    if (body || delim) semiRaw.push(body + delim);
  }
  const semi = foldShortChunks(semiRaw, 10);
  if (semi.length >= 2 && semi.filter(c => extractAllDates(c).length > 0).length >= 2) {
    return { chunks: semi, strategy: 'semicolon' };
  }

  // A1(1) (BLOCKER): Strategy 5 — date-anchored prose slicing — is DELETED.
  // It had no structural precondition, fired on any prose containing two dates
  // (an incident date plus a court date is the NORMAL shape of this data),
  // corrupted text via a hardcoded +20 character offset, and was the strategy
  // that re-expanded pass 1's output on pass 2.
  return { chunks: [cleaned], strategy: 'none' };
}

/**
 * B2. An entry is a separately-recordable incident only if it carries a date AND
 * an actor or a place. Anything else is a continuation of its neighbour.
 */
function qualifies(entry: string, knownTowns: string[]): boolean {
  if (entry.length < MIN_ENTRY_CHARS) return false;               // B1
  if (extractAllDates(entry).length === 0) return false;
  return extractNames(entry).length > 0 || extractLocation(entry, knownTowns) !== null;
}

/**
 * Produce the split plan for one summary. Pure — no incident, no side effects —
 * so the UI can preview a plan without committing anything.
 */
export function planSplit(text: string, knownTowns: string[]): SplitPlan {
  if (!text || text.trim().length < MIN_ENTRY_CHARS) {
    return { entries: [text ?? ''], strategy: 'none', capped: false, mergedFragments: 0 };
  }

  const cleaned = cleanOcrText(text);
  const { chunks, strategy } = structuralSplit(cleaned);
  if (chunks.length < 2) {
    return { entries: [cleaned], strategy: 'none', capped: false, mergedFragments: 0 };
  }

  // B2. Non-qualifying fragments are MERGED BACK into the preceding entry.
  // Never dropped (no data loss) and never promoted to their own incident.
  // The single exception is the very first chunk, which is a structural record
  // start and has no predecessor to attach to.
  const merged: string[] = [];
  let mergedFragments = 0;
  for (const chunk of chunks) {
    if (qualifies(chunk, knownTowns) || merged.length === 0) {
      merged.push(chunk);
    } else {
      merged[merged.length - 1] += ' ' + chunk;
      mergedFragments++;
    }
  }

  // Splitting is only justified if at least two entries independently qualify.
  if (merged.filter(e => qualifies(e, knownTowns)).length < 2) {
    return { entries: [cleaned], strategy: 'none', capped: false, mergedFragments: 0 };
  }

  // B3. Hard fan-out cap. The excess is kept as ONE overflow record so that no
  // source text is lost; it carries capped=true and needsReview=true.
  if (merged.length > MAX_SPLIT_FACTOR) {
    const head = merged.slice(0, MAX_SPLIT_FACTOR - 1);
    const overflow = merged.slice(MAX_SPLIT_FACTOR - 1).join('\n');
    return { entries: [...head, overflow], strategy, capped: true, mergedFragments };
  }

  return { entries: merged, strategy, capped: false, mergedFragments };
}

// ---------------------------------------------------------------------------
// Casualties — explicit numeric extraction ONLY
// ---------------------------------------------------------------------------

/**
 * E1 (BLOCKER). Returns undefined when the text states no number.
 * No keyword→count inference, no division of the parent total. An unknown
 * casualty count must read as unknown, not as a plausible-looking figure that
 * downstream code exports under the field name "fatality_count_confirmed".
 *
 * Each figure is INDEPENDENTLY optional. Text stating only an injury count says
 * nothing about fatalities, so `deceased` is left undefined rather than set to
 * 0 — a 0 here is indistinguishable from a confirmed zero and is summed into
 * the figure the UI labels "Total deceased recorded".
 */
export function parseCasualties(text: string): { deceased?: number; injured?: number } | undefined {
  const d = text.match(/(\d+)\s*(?:people\s+)?(?:were\s+)?(?:killed|dead|deceased|murdered|fatally)/i);
  const i = text.match(/(\d+)\s*(?:people\s+)?(?:were\s+)?(?:injured|wounded|hospitalised|hospitalized)/i);
  if (!d && !i) return undefined;
  const out: { deceased?: number; injured?: number } = {};
  if (d) out.deceased = parseInt(d[1]!, 10);
  if (i) out.injured = parseInt(i[1]!, 10);
  return out;
}

// ---------------------------------------------------------------------------
// Core: detect and split a multi-incident entry
// ---------------------------------------------------------------------------

interface SplitGroup {
  entries: string[];
  date: string | null;
  location: string | null;
  names: string[];
}

/** Geocoder contract. Returning null/undefined means "unresolved" — the caller
 *  must not invent a position; the split product inherits the parent's. */
export type GeocodeFn = (
  town: string,
  province: string,
) => { lat: number; lng: number } | null | undefined;

export function splitMultiIncidentEntry(
  inc: MockIncident,
  knownTowns: string[],
  geocodeFn: GeocodeFn,
): MockIncident[] {
  return splitWithPlan(inc, knownTowns, geocodeFn).incidents;
}

/** Internal: same as splitMultiIncidentEntry but also returns the plan, so the
 *  batch function can report counters without re-parsing every summary. */
function splitWithPlan(
  inc: MockIncident,
  knownTowns: string[],
  geocodeFn: GeocodeFn,
): { incidents: MockIncident[]; plan: SplitPlan | null } {
  // A (PRIMARY IDEMPOTENCY GUARD). A product of a previous split is never
  // re-split. This makes re-splitting structurally impossible rather than
  // arithmetically convergent, is O(1), survives the IndexedDB round-trip
  // (plain JSON), and remains correct if new strategies are added later.
  if (inc.splitFrom) return { incidents: [inc], plan: null };

  const plan = planSplit(inc.summary, knownTowns);
  if (plan.entries.length <= 1) return { incidents: [inc], plan };

  const parsed = plan.entries.map(entry => ({
    text: entry,
    date: extractFirstDate(entry),
    location: extractLocation(entry, knownTowns),
    names: extractNames(entry),
  }));

  const groupMap = new Map<string, SplitGroup>();
  for (const p of parsed) {
    const dateKey = p.date ?? inc.dateOccurred ?? '_unknown_';
    const locationKey = (p.location ?? inc.town ?? '_unknown_').toLowerCase();
    const key = `${dateKey}||${locationKey}`;

    let group = groupMap.get(key);
    if (!group) {
      group = { entries: [], date: p.date, location: p.location, names: [] };
      groupMap.set(key, group);
    }
    group.entries.push(p.text);
    group.names.push(...p.names);
  }

  if (groupMap.size <= 1) return { incidents: [inc], plan };

  // The guard above guarantees inc.splitFrom is undefined here, so this incident
  // is always its own lineage root and its children are always generation 1.
  const rootId = inc.id;
  const parentGeneration = 0;
  const results: MockIncident[] = [];
  const usedIds = new Set<string>();

  for (const group of groupMap.values()) {
    const summary = group.entries.join('\n');
    const uniqueNames = [...new Set(group.names)];
    const inferredFields = new Set<string>(inc.inferredFields ?? []);

    // Location. Only re-geocode when this group actually resolved its own town.
    // Otherwise inherit the parent's town AND its coordinates — re-geocoding an
    // unresolved town is what made every run relocate every incident.
    let town = inc.town;
    let lat = inc.lat;
    let lng = inc.lng;
    if (group.location) {
      town = group.location;
      const coords = geocodeFn(group.location, inc.province);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      } else {
        inferredFields.add('coords:unresolved');
      }
    } else {
      inferredFields.add('town:inherited');
      inferredFields.add('coords:inherited');
    }

    // C1. Stable, content-derived id. The same content always yields the same
    // id, so a re-import or a re-run is recognisable as the same record.
    // canonicalText collapses \s+ so newline-vs-space cannot change the key.
    const entryHash = stableHash([
      rootId,
      canonicalText(summary),
      group.date ?? '',
      (group.location ?? '').toLowerCase(),
    ].join(' '));
    let id = `${rootId}-s${entryHash}`;
    let n = 1;
    while (usedIds.has(id)) id = `${rootId}-s${entryHash}.${n++}`;
    usedIds.add(id);

    // E2. Never echo raw source text into the public title. The old fallback
    // (`entries[0].slice(0, 80)`) republished un-redacted ALL-CAPS surnames.
    //
    // G1 (BLOCKER). The title MUST carry the entry hash. incidentFingerprint()
    // is keyed on (title, date, town); a purely structural title
    // "Unidentified incident — <place> — <date>" is a pure function of two of
    // those three, so every nameless split product sharing a town and date
    // collided. Colliding records were silently dropped by the store's import
    // guard and permanently deleted by "Remove Duplicates". Appending the
    // content-derived hash makes the fingerprint unique per entry and doubles
    // as a visible marker that this record is a machine-produced fragment.
    const place = town || inc.province || 'Unknown location';
    const subject = uniqueNames.length > 0
      ? `${uniqueNames.slice(0, 3).join(', ')}${uniqueNames.length > 3 ? ` +${uniqueNames.length - 3}` : ''}`
      : 'Unidentified incident';
    const title = `${subject} — ${place}${group.date ? ` — ${group.date}` : ''} · entry ${entryHash}`;
    if (uniqueNames.length === 0) inferredFields.add('title:structural');

    // E1. Explicit counts only. The parent's figure is preserved for audit on
    // splitFrom.parentCasualties; a human assigns it.
    const own = parseCasualties(summary);
    if (!own && inc.casualties) inferredFields.add('casualties:unassigned');
    if (!group.date && inc.dateOccurred) inferredFields.add('date:inherited');
    if (plan.capped) inferredFields.add('entries:capped');
    // G2. The name in the title and in victimName is pattern-matched out of the
    // entry text, never read from a source column. Flag it like every other
    // machine-derived field so the UI can say so.
    if (uniqueNames.length > 0) inferredFields.add('victimName:extracted');

    results.push({
      ...inc,
      id,
      title,
      summary,
      dateOccurred: group.date ?? inc.dateOccurred,
      town,
      lat,
      lng,
      casualties: own,
      // Do not inherit the parent's victimName — attributing the parent's named
      // victim to an arbitrary sub-incident is a fabricated attribution.
      // G3 (BLOCKER): but do not DESTROY it either. For CSV / AI-sorted imports
      // that value came from an explicitly mapped SOURCE COLUMN, and the parent
      // record is replaced by its children, so dropping it loses source data
      // irrecoverably. It is preserved verbatim on splitFrom.parentVictimName.
      victimName: uniqueNames[0] ?? undefined,
      splitFrom: {
        rootId,
        parentId: inc.id,
        generation: parentGeneration + 1,
        strategy: plan.strategy,
        entryHash,
        capped: plan.capped || undefined,
        parentCasualties: inc.casualties ? { ...inc.casualties } : undefined,
        parentVictimName: inc.victimName || undefined,
        parentTitle: inc.title || undefined,
        parentSummary: inc.summary || undefined,
      },
      inferredFields: inferredFields.size ? [...inferredFields] : undefined,
      // E3/E5. Everything the splitter produces is machine-derived and must be
      // excluded from published counts until a human confirms it. severity and
      // module are inherited from the parent's keyword classifier and are not
      // independently evidenced for the child.
      needsReview: true,
    });
  }

  return { incidents: results, plan };
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

export interface SplitOffender {
  /** id of the source row that fanned out. */
  id: string;
  /** Number of incidents produced from it. */
  childCount: number;
  /** True if the row hit MAX_SPLIT_FACTOR. */
  capped: boolean;
  /** First 100 characters of the source summary, for the confirmation dialog. */
  excerpt: string;
}

export interface SplitBatchResult {
  result: MockIncident[];
  /** Rows that produced more than one incident. */
  splitCount: number;
  /** result.length — kept for source compatibility with existing call sites. */
  newTotal: number;
  /** incidents.length before splitting. */
  originalTotal: number;
  /** Rows skipped because they were already split products (idempotency guard). */
  skipped: number;
  /** Rows that hit MAX_SPLIT_FACTOR and had their tail folded into one record. */
  capped: number;
  /** Chunks that failed the evidence gate and were merged back into a neighbour. */
  mergedFragments: number;
  /** newTotal / originalTotal. Compare against MAX_BATCH_FACTOR before committing. */
  factor: number;
  /** True when factor exceeds MAX_BATCH_FACTOR — the caller must refuse. */
  exceedsBatchLimit: boolean;
  /** Top fan-out sources, descending by childCount (max 5). */
  worstOffenders: SplitOffender[];
}

export function splitAllMultiIncidents(
  incidents: MockIncident[],
  knownTowns: string[],
  geocodeFn: GeocodeFn,
): SplitBatchResult {
  const result: MockIncident[] = [];
  const offenders: SplitOffender[] = [];
  let splitCount = 0;
  let skipped = 0;
  let capped = 0;
  let mergedFragments = 0;

  for (const inc of incidents) {
    if (inc.splitFrom) {
      skipped++;
      result.push(inc);
      continue;
    }

    const { incidents: split, plan } = splitWithPlan(inc, knownTowns, geocodeFn);

    if (split.length > 1) {
      splitCount++;
      const wasCapped = plan?.capped === true;
      if (wasCapped) capped++;
      mergedFragments += plan?.mergedFragments ?? 0;
      offenders.push({
        id: inc.id,
        childCount: split.length,
        capped: wasCapped,
        excerpt: (inc.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
      });
    }

    result.push(...split);
  }

  const originalTotal = incidents.length;
  const newTotal = result.length;
  const factor = originalTotal === 0 ? 1 : newTotal / originalTotal;

  return {
    result,
    splitCount,
    newTotal,
    originalTotal,
    skipped,
    capped,
    mergedFragments,
    factor,
    exceedsBatchLimit: factor > MAX_BATCH_FACTOR,
    worstOffenders: offenders.sort((a, b) => b.childCount - a.childCount).slice(0, 5),
  };
}
