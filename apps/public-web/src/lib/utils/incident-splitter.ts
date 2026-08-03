import type { MockIncident } from '@/data/mock-incidents';

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

const DATE_RE_YMD = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g;
const DATE_RE_DMY = /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/g;

function normalizeDateMatch(match: RegExpMatchArray, type: 'word' | 'ymd' | 'dmy'): string | null {
  if (type === 'word') {
    const monthKey = match[2]!.toLowerCase().slice(0, 3);
    const mm = MONTH_MAP[monthKey];
    if (!mm) return null;
    return `${match[3]}-${mm}-${match[1]!.padStart(2, '0')}`;
  }
  if (type === 'ymd') {
    return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`;
  }
  // dmy
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

  return results.sort((a, b) => a.index - b.index);
}

function extractFirstDate(text: string): string | null {
  const dates = extractAllDates(text);
  return dates.length > 0 ? dates[0]!.date : null;
}

// ---------------------------------------------------------------------------
// Name extraction (handles Afrikaans names with particles)
// ---------------------------------------------------------------------------

const NAME_PARTICLES = new Set([
  'van', 'de', 'du', 'le', 'von', 'la', 'den', 'der', 'het', 'ten',
  'ter', 'op', 'die',
]);

const NOT_A_NAME = new Set([
  'the', 'and', 'was', 'were', 'has', 'had', 'been', 'not', 'but',
  'for', 'with', 'from', 'that', 'this', 'have', 'are', 'his', 'her',
  'farm', 'attack', 'murder', 'killed', 'shot', 'near', 'area',
  'district', 'province', 'police', 'saps', 'case', 'court',
  'south', 'north', 'east', 'west', 'january', 'february', 'march',
  'april', 'june', 'july', 'august', 'september', 'october',
  'november', 'december', 'unknown', 'imported', 'incident',
]);

function extractNames(text: string): string[] {
  const names: string[] = [];
  const re = /\b([A-Z][a-z]{1,}(?:\s+(?:van|de|du|le|von|la|den|der|het|ten|ter|op|die)\s+)?(?:\s+[A-Z][a-z]{1,})+)\b/g;
  for (const m of text.matchAll(re)) {
    const name = m[1]!;
    const firstWord = name.split(/\s+/)[0]!.toLowerCase();
    if (NOT_A_NAME.has(firstWord)) continue;
    if (name.split(/\s+/).length > 5) continue;
    names.push(name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Location extraction
// ---------------------------------------------------------------------------

function extractLocation(text: string, knownTowns: string[]): string | null {
  const lower = text.toLowerCase();

  for (const town of knownTowns) {
    if (lower.includes(town.toLowerCase())) return town;
  }

  const locPatterns = [
    /(?:in|at|near|from|outside|between)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g,
    /(?:farm|plaas|smallholding)\s+(?:near|outside|at)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/gi,
  ];
  for (const re of locPatterns) {
    for (const m of text.matchAll(re)) {
      const loc = m[1]!.trim();
      if (loc.length > 2 && !NOT_A_NAME.has(loc.toLowerCase())) return loc;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Entry splitting — breaks a summary into individual sub-entries
// ---------------------------------------------------------------------------

function splitIntoEntries(text: string): string[] {
  if (!text || text.trim().length < 20) return [text];

  // Strategy 1: Numbered entries (1. 2. 3. or 1) 2) 3))
  const numberedChunks = text.split(/\n\s*(?=\d+[\.\)]\s)/);
  if (numberedChunks.length >= 2 && numberedChunks.every(c => c.trim().length > 5)) {
    return numberedChunks.map(c => c.trim()).filter(c => c.length > 5);
  }

  // Strategy 2: Bullet points
  const bulletChunks = text.split(/\n\s*(?=[-•▪]\s)/);
  if (bulletChunks.length >= 2 && bulletChunks.every(c => c.trim().length > 5)) {
    return bulletChunks.map(c => c.trim()).filter(c => c.length > 5);
  }

  // Strategy 3: Newline-separated entries where each line has content
  const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 10);
  if (lines.length >= 2) {
    const datesInLines = lines.filter(l => extractAllDates(l).length > 0).length;
    const namesInLines = lines.filter(l => extractNames(l).length > 0).length;
    if (datesInLines >= 2 || namesInLines >= 2) {
      return lines;
    }
  }

  // Strategy 4: Semicolon-separated
  const semiChunks = text.split(/;\s*/).filter(c => c.trim().length > 10);
  if (semiChunks.length >= 2) {
    const datesInChunks = semiChunks.filter(c => extractAllDates(c).length > 0).length;
    if (datesInChunks >= 2) return semiChunks.map(c => c.trim());
  }

  // Strategy 5: Date-anchored splitting — split before each date occurrence
  const allDates = extractAllDates(text);
  if (allDates.length >= 2) {
    const chunks: string[] = [];
    for (let i = 0; i < allDates.length; i++) {
      const start = i === 0 ? 0 : allDates[i]!.index;
      const end = i < allDates.length - 1 ? allDates[i + 1]!.index : text.length;

      // Look backwards from the date position to find a reasonable start
      // (the name/entry likely begins before the date)
      let entryStart = start;
      if (i > 0) {
        const prevEnd = allDates[i - 1]!.index + 20;
        const gap = text.slice(prevEnd, start);
        // Find the last sentence/name boundary in the gap
        const boundaryMatch = gap.match(/.*[.;,]\s*/s);
        entryStart = boundaryMatch
          ? prevEnd + boundaryMatch[0].length
          : prevEnd;
      }

      const chunk = text.slice(entryStart, end).trim();
      if (chunk.length > 5) chunks.push(chunk);
    }
    if (chunks.length >= 2) return chunks;
  }

  return [text];
}

// ---------------------------------------------------------------------------
// Core: Detect and split a multi-incident entry
// ---------------------------------------------------------------------------

interface SplitGroup {
  dateKey: string;
  locationKey: string;
  entries: string[];
  date: string | null;
  location: string | null;
  names: string[];
}

export function splitMultiIncidentEntry(
  inc: MockIncident,
  knownTowns: string[],
  geocodeFn: (town: string, province: string) => { lat: number; lng: number },
): MockIncident[] {
  const entries = splitIntoEntries(inc.summary);

  if (entries.length <= 1) return [inc];

  // Parse each entry
  const parsed = entries.map(entry => ({
    text: entry,
    date: extractFirstDate(entry),
    location: extractLocation(entry, knownTowns),
    names: extractNames(entry),
  }));

  // Group by (date, location) — user's rule:
  // Same date AND same location → one incident
  // Different date OR different location → separate incidents
  const groupMap = new Map<string, SplitGroup>();

  for (const p of parsed) {
    const dateKey = p.date ?? inc.dateOccurred ?? '_unknown_';
    const locationKey = (p.location ?? inc.town ?? '_unknown_').toLowerCase();
    const key = `${dateKey}||${locationKey}`;

    let group = groupMap.get(key);
    if (!group) {
      group = {
        dateKey,
        locationKey,
        entries: [],
        date: p.date,
        location: p.location,
        names: [],
      };
      groupMap.set(key, group);
    }
    group.entries.push(p.text);
    group.names.push(...p.names);
  }

  // If everything falls into one group, no splitting needed
  if (groupMap.size <= 1) return [inc];

  // Create new incidents for each group
  const results: MockIncident[] = [];
  let splitIdx = 0;

  for (const group of groupMap.values()) {
    const town = group.location ?? inc.town;
    const province = inc.province;
    const coords = geocodeFn(town, province);

    const uniqueNames = [...new Set(group.names)];
    const title = uniqueNames.length > 0
      ? `${uniqueNames.slice(0, 3).join(', ')}${uniqueNames.length > 3 ? ` +${uniqueNames.length - 3}` : ''} — ${town || province || 'Unknown location'}`
      : group.entries[0]!.slice(0, 80) || `${inc.title} (${splitIdx + 1})`;

    const summary = group.entries.join('\n');

    const nameCount = Math.max(1, uniqueNames.length);
    const existingDeceased = inc.casualties?.deceased ?? 0;
    const existingInjured = inc.casualties?.injured ?? 0;
    const totalOriginalVictims = groupMap.size;

    results.push({
      ...inc,
      id: `${inc.id}-s${splitIdx}`,
      title,
      summary,
      dateOccurred: group.date ?? inc.dateOccurred,
      town: town,
      lat: coords.lat,
      lng: coords.lng,
      casualties: {
        deceased: existingDeceased > 0
          ? Math.max(1, Math.round(existingDeceased / totalOriginalVictims))
          : (/\b(?:killed|murdered|dead|deceased|slain|shot dead|fatal)\b/i.test(summary) ? nameCount : 0),
        injured: existingInjured > 0
          ? Math.max(0, Math.round(existingInjured / totalOriginalVictims))
          : (/\b(?:injured|wounded|hospitalised|hospitalized|assaulted|attacked)\b/i.test(summary) ? nameCount : 0),
      },
      victimName: uniqueNames[0] ?? inc.victimName,
    });

    splitIdx++;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Batch: process an array of incidents, splitting multi-incident entries
// ---------------------------------------------------------------------------

export function splitAllMultiIncidents(
  incidents: MockIncident[],
  knownTowns: string[],
  geocodeFn: (town: string, province: string) => { lat: number; lng: number },
): { result: MockIncident[]; splitCount: number; newTotal: number } {
  const result: MockIncident[] = [];
  let splitCount = 0;

  for (const inc of incidents) {
    const split = splitMultiIncidentEntry(inc, knownTowns, geocodeFn);
    if (split.length > 1) splitCount++;
    result.push(...split);
  }

  return { result, splitCount, newTotal: result.length };
}
