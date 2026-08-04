/**
 * Incident date normalisation and time windowing.
 *
 * Every incident date in this app is an ARBITRARY STRING. Four producers write
 * `dateOccurred` and none of them agree:
 *   1. mock-incidents.ts          -> 'YYYY-MM-DD'
 *   2. AdminImport row builders   -> the raw source cell, verbatim ('12/05/2000',
 *                                    '12 Mei 2000', '', an Excel serial, anything)
 *   3. incident-splitter.ts       -> 'YYYY-MM-DD' when it extracted one, otherwise
 *                                    the parent's raw string, inherited
 *   4. useIncidentData rowToMock  -> a full ISO timestamptz from PostgREST
 *
 * So normalisation MUST happen at the point of comparison. Normalising once at
 * import time would not fix records already sitting in IndexedDB.
 *
 * Two rules this module exists to enforce:
 *   - NEVER produce NaN or an Invalid Date. `new Date('')` is Invalid Date and
 *     every comparison against it is false, which silently drops the record.
 *     Nothing here calls Date parsing on source text.
 *   - NEVER fabricate precision. A source that says "2000" is not a source that
 *     says "1 January 2000". Such a value normalises to the INTERVAL
 *     2000-01-01..2000-12-31 and is matched by overlap, so it is included in a
 *     "year 2000" window without inventing a day.
 */

// ---------------------------------------------------------------------------
// Normalised value
// ---------------------------------------------------------------------------

/**
 * A normalised incident date. `start`/`end` are inclusive 'YYYY-MM-DD' bounds
 * of the interval the source actually supports.
 *   day   -> start === end, an exact date
 *   month -> the whole month
 *   year  -> the whole year
 *   none  -> no usable date. NEVER compared. Routed to the undated bucket.
 */
export type NormalizedDate =
  | { kind: 'day'; start: string; end: string }
  | { kind: 'month'; start: string; end: string }
  | { kind: 'year'; start: string; end: string }
  | { kind: 'none'; raw: string };

const NONE = (raw: string): NormalizedDate => ({ kind: 'none', raw });

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS: Record<string, string> = {
  jan: '01', january: '01', januarie: '01',
  feb: '02', february: '02', februarie: '02',
  mar: '03', march: '03', maart: '03', mrt: '03',
  apr: '04', april: '04',
  may: '05', mei: '05',
  jun: '06', june: '06', junie: '06',
  jul: '07', july: '07', julie: '07',
  aug: '08', august: '08', augustus: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10', okt: '10', oktober: '10',
  nov: '11', november: '11',
  dec: '12', december: '12', des: '12', desember: '12',
};

const MIN_YEAR = 1800;
const MAX_YEAR = 2200;

function validYear(y: number): boolean {
  return Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR;
}

/** Days in month, 1-indexed month. Proleptic Gregorian, no Date object. */
function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}

/** Build a day interval, validating the calendar. Returns null if impossible. */
function dayValue(y: number, m: number, d: number): NormalizedDate | null {
  if (!validYear(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  const s = `${y}-${pad2(m)}-${pad2(d)}`;
  return { kind: 'day', start: s, end: s };
}

function monthValue(y: number, m: number): NormalizedDate | null {
  if (!validYear(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return {
    kind: 'month',
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(daysInMonth(y, m))}`,
  };
}

function yearValue(y: number): NormalizedDate | null {
  if (!validYear(y)) return null;
  return { kind: 'year', start: `${y}-01-01`, end: `${y}-12-31` };
}

/**
 * Excel/LibreOffice date serial -> calendar date. Only accepted for integers in
 * 20000..60000 (1954-08-25 .. 2064-04-04), which is narrow enough that a bare
 * year like '2000' or a casualty count can never be mistaken for one.
 */
function fromExcelSerial(n: number): NormalizedDate | null {
  if (!Number.isInteger(n) || n < 20000 || n > 60000) return null;
  // Serial 25569 === 1970-01-01. Pure integer arithmetic on UTC days; no local
  // timezone is ever consulted, so this cannot shift by a day.
  const utcMs = (n - 25569) * 86400000;
  const dt = new Date(utcMs);
  if (Number.isNaN(dt.getTime())) return null;
  return dayValue(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// Normalisation is called for every incident on every filter change. The same
// raw strings repeat heavily (whole columns share a format), so memoise.
const cache = new Map<string, NormalizedDate>();
const CACHE_MAX = 20000;

/**
 * Normalise any incident date value. TOTAL FUNCTION: never throws, never
 * returns Invalid Date, never returns NaN. Unrecognisable input -> kind 'none'.
 */
export function normalizeIncidentDate(raw: unknown): NormalizedDate {
  if (typeof raw !== 'string') {
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) return NONE(String(raw));
      return fromExcelSerial(raw) ?? yearValue(raw) ?? NONE(String(raw));
    }
    if (raw instanceof Date) {
      const t = raw.getTime();
      if (Number.isNaN(t)) return NONE('Invalid Date');
      return dayValue(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate())
        ?? NONE(String(t));
    }
    if (raw == null) return NONE('');
    try {
      return NONE(String(raw));
    } catch {
      return NONE('');
    }
  }
  const hit = cache.get(raw);
  if (hit) return hit;

  const out = compute(raw);
  if (cache.size < CACHE_MAX) cache.set(raw, out);
  return out;
}

function compute(raw: string): NormalizedDate {
  const s = raw.trim();
  if (!s) return NONE(raw);

  // 1. ISO day, or a full ISO timestamp. Slice to the calendar-day prefix.
  //    NOTE: for an API timestamptz this takes the UTC day, which for an
  //    incident recorded at SAST midnight is one day early. That is a known,
  //    bounded 1-day boundary effect and is strictly safer than Date parsing,
  //    which introduces the same skew AND can produce NaN.
  if (s.length >= 10) {
    const head = s.slice(0, 10);
    if (ISO_DAY_RE.test(head)) {
      const v = dayValue(+head.slice(0, 4), +head.slice(5, 7), +head.slice(8, 10));
      if (v) return v;
    }
  }

  let m: RegExpMatchArray | null;

  // 2. Y/M/D or Y-M-D with unpadded parts: '2000/5/12'
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    const v = dayValue(+m[1]!, +m[2]!, +m[3]!);
    if (v) return v;
  }

  // 3. D/M/Y — South African convention, which is what the source lists use.
  //    '12/05/2000' is 12 May 2000, NOT 5 December. Ambiguity is resolved by
  //    locale convention; where the first field is > 12 it is unambiguous.
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
    let ys = m[3]!;
    if (ys.length === 2) ys = +ys > 50 ? `19${ys}` : `20${ys}`;
    // A 3-digit year is OCR truncation, not a date. Reject rather than accept a
    // malformed value that would land INSIDE a plausible-looking window
    // ('200-05-12' sorts after every 19xx date and just before '2000-…').
    if (ys.length === 4) {
      const v = dayValue(+ys, +m[2]!, +m[1]!);
      if (v) return v;
    }
  }

  // 4. Word month, day-first: '12 May 2000', '12 Mei 2000'
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/))) {
    const mm = MONTHS[m[2]!.toLowerCase()];
    if (mm) {
      const v = dayValue(+m[3]!, +mm, +m[1]!);
      if (v) return v;
    }
  }

  // 5. Word month, month-first: 'May 12, 2000'
  if ((m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/))) {
    const mm = MONTHS[m[1]!.toLowerCase()];
    if (mm) {
      const v = dayValue(+m[3]!, +mm, +m[2]!);
      if (v) return v;
    }
  }

  // 6. MONTH PRECISION. 'May 2000' / 'Mei 2000' / '2000-05'.
  //    Kept as a month interval. Inventing day 1 would be fabrication.
  if ((m = s.match(/^([A-Za-z]+)\.?\s+(\d{4})$/))) {
    const mm = MONTHS[m[1]!.toLowerCase()];
    if (mm) {
      const v = monthValue(+m[2]!, +mm);
      if (v) return v;
    }
  }
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})$/))) {
    const v = monthValue(+m[1]!, +m[2]!);
    if (v) return v;
  }

  // 7. YEAR PRECISION. A bare '2000'. Checked BEFORE the Excel serial branch,
  //    and the serial window starts at 20000, so the two can never collide.
  if (/^\d{4}$/.test(s)) {
    const v = yearValue(+s);
    if (v) return v;
  }

  // 8. Excel/LibreOffice serial.
  if (/^\d{5}$/.test(s)) {
    const v = fromExcelSerial(+s);
    if (v) return v;
  }

  // Anything else — free prose, 'unknown', '?', a 3-digit year, a malformed
  // cell — is NOT a date. It goes to the undated bucket where it is counted and
  // disclosed, never compared and never silently dropped.
  return NONE(raw);
}

/** Convenience: the exact day, or null when the value is not day-precise. */
export function toIsoDay(raw: unknown): string | null {
  const n = normalizeIncidentDate(raw);
  return n.kind === 'day' ? n.start : null;
}

/** True when the value carries no usable date at all. */
export function isUndated(raw: unknown): boolean {
  return normalizeIncidentDate(raw).kind === 'none';
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export type TimePreset = 'last7' | 'last30' | 'last12m' | 'thisYear';

export const TIME_PRESETS: readonly TimePreset[] = ['last7', 'last30', 'last12m', 'thisYear'];

export type TimeFilter =
  | { mode: 'all' }
  | { mode: 'preset'; preset: TimePreset }
  | { mode: 'year'; year: number }
  | { mode: 'range'; from: string | null; to: string | null };

/** Inclusive window. null on either side means unbounded on that side. */
export interface DateBounds {
  from: string | null;
  to: string | null;
}

export const ALL_TIME: TimeFilter = { mode: 'all' };
export const UNBOUNDED: DateBounds = { from: null, to: null };

/**
 * Today as a LOCAL calendar day. Never toISOString() — that is UTC and is one
 * day behind for SAST users after 22:00 local.
 */
export function todayIsoDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Shift an ISO day by N days using UTC arithmetic — DST-immune by construction. */
export function shiftDays(isoDay: string, delta: number): string {
  const t = Date.UTC(+isoDay.slice(0, 4), +isoDay.slice(5, 7) - 1, +isoDay.slice(8, 10))
    + delta * 86400000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Shift by whole months, clamping the day to the target month's length. */
export function shiftMonths(isoDay: string, delta: number): string {
  const y = +isoDay.slice(0, 4), mo = +isoDay.slice(5, 7), d = +isoDay.slice(8, 10);
  const total = y * 12 + (mo - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, daysInMonth(ny, nm)))}`;
}

/** Runtime validator — a persisted or URL-supplied value can be anything. */
export function isTimeFilter(v: unknown): v is TimeFilter {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  switch (f.mode) {
    case 'all': return true;
    case 'preset': return TIME_PRESETS.includes(f.preset as TimePreset);
    case 'year': return typeof f.year === 'number' && validYear(f.year);
    case 'range':
      return (f.from === null || typeof f.from === 'string')
        && (f.to === null || typeof f.to === 'string');
    default: return false;
  }
}

/**
 * Resolve a filter to inclusive bounds. `today` is injected so this is a pure
 * function and so tests do not depend on the wall clock.
 */
export function resolveBounds(f: TimeFilter, today: string = todayIsoDay()): DateBounds {
  switch (f.mode) {
    case 'all':
      return UNBOUNDED;
    case 'preset':
      switch (f.preset) {
        case 'last7':    return { from: shiftDays(today, -6), to: today };
        case 'last30':   return { from: shiftDays(today, -29), to: today };
        case 'last12m':  return { from: shiftDays(shiftMonths(today, -12), 1), to: today };
        case 'thisYear': return { from: `${today.slice(0, 4)}-01-01`, to: today };
        default:         return UNBOUNDED;
      }
    case 'year':
      return validYear(f.year)
        ? { from: `${f.year}-01-01`, to: `${f.year}-12-31` }
        : UNBOUNDED;
    case 'range': {
      // Guard against inputs a user can physically type into <input type="date">
      // in the wrong order. Swap rather than yield an empty window.
      const a = f.from && ISO_DAY_RE.test(f.from) ? f.from : null;
      const b = f.to && ISO_DAY_RE.test(f.to) ? f.to : null;
      if (a && b && a > b) return { from: b, to: a };
      return { from: a, to: b };
    }
    default:
      return UNBOUNDED;
  }
}

export function isBounded(b: DateBounds): boolean {
  return b.from !== null || b.to !== null;
}

/**
 * Does a normalised date fall in the window? INTERVAL OVERLAP, not point
 * containment — a record the source dates only to "2000" overlaps a 2000 window
 * and also a 1998..2002 window, without our inventing a day for it.
 *
 * `kind: 'none'` always returns false; callers branch on it explicitly BEFORE
 * calling, so an undated record is never removed by a failed comparison.
 * Comparison is lexicographic on fixed-width zero-padded 'YYYY-MM-DD', which is
 * chronological for that shape, total, and cannot produce NaN.
 */
export function overlaps(d: NormalizedDate, b: DateBounds): boolean {
  if (d.kind === 'none') return false;
  if (b.from !== null && d.end < b.from) return false;
  if (b.to !== null && d.start > b.to) return false;
  return true;
}

/** One-shot predicate over a raw value. Undated -> `includeUndated`. */
export function matchesWindow(raw: unknown, b: DateBounds, includeUndated = true): boolean {
  if (!isBounded(b)) return true;
  const d = normalizeIncidentDate(raw);
  if (d.kind === 'none') return includeUndated;
  return overlaps(d, b);
}

// ---------------------------------------------------------------------------
// Applying the filter
// ---------------------------------------------------------------------------

export interface TimeFilterResult<T> {
  /** The records that survive the window. */
  matched: T[];
  /** Everything that went in. */
  totalCount: number;
  /** matched.length — the published count. */
  inRangeCount: number;
  /** Records whose date is usable but falls outside the window. */
  outOfRangeCount: number;
  /** Records with no usable date at all, in the WHOLE input. */
  undatedCount: number;
  /** True when undated records were included in `matched`. */
  undatedIncluded: boolean;
}

export function applyTimeFilter<T>(
  items: T[],
  getRaw: (item: T) => unknown,
  bounds: DateBounds,
  includeUndated: boolean,
): TimeFilterResult<T> {
  if (!isBounded(bounds)) {
    // "All time" includes everything, undated records emphatically included.
    let undated = 0;
    for (const it of items) {
      if (normalizeIncidentDate(getRaw(it)).kind === 'none') undated++;
    }
    return {
      matched: items,
      totalCount: items.length,
      inRangeCount: items.length,
      outOfRangeCount: 0,
      undatedCount: undated,
      undatedIncluded: true,
    };
  }

  const matched: T[] = [];
  let outside = 0;
  let undated = 0;
  for (const it of items) {
    const d = normalizeIncidentDate(getRaw(it));
    if (d.kind === 'none') {
      // An undated record is NEVER compared. It is counted here and either
      // included or explicitly excluded — there is no silent-drop path.
      undated++;
      if (includeUndated) matched.push(it);
      continue;
    }
    if (overlaps(d, bounds)) matched.push(it);
    else outside++;
  }
  return {
    matched,
    totalCount: items.length,
    inRangeCount: matched.length,
    outOfRangeCount: outside,
    undatedCount: undated,
    undatedIncluded: includeUndated,
  };
}

// ---------------------------------------------------------------------------
// Data extent — powers the year list in the dropdown
// ---------------------------------------------------------------------------

export interface DataExtent {
  minDay: string;
  maxDay: string;
  minYear: number;
  maxYear: number;
  /** Every year with at least one dated record, descending. */
  years: number[];
}

export function computeExtent<T>(items: T[], getRaw: (item: T) => unknown): DataExtent | null {
  const seen = new Set<number>();
  let min: string | null = null;
  let max: string | null = null;
  for (const it of items) {
    const d = normalizeIncidentDate(getRaw(it));
    if (d.kind === 'none') continue;
    if (min === null || d.start < min) min = d.start;
    if (max === null || d.end > max) max = d.end;
    const y0 = +d.start.slice(0, 4);
    const y1 = +d.end.slice(0, 4);
    for (let y = y0; y <= y1; y++) seen.add(y);
  }
  if (min === null || max === null) return null;
  return {
    minDay: min,
    maxDay: max,
    minYear: +min.slice(0, 4),
    maxYear: +max.slice(0, 4),
    years: [...seen].sort((a, b) => b - a),
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const PRESET_LABELS: Record<TimePreset, string> = {
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  last12m: 'Last 12 months',
  thisYear: 'This year',
};

export function describeFilter(f: TimeFilter): string {
  switch (f.mode) {
    case 'all': return 'All time';
    case 'preset': return PRESET_LABELS[f.preset] ?? 'All time';
    case 'year': return String(f.year);
    case 'range': {
      const b = resolveBounds(f);
      if (b.from && b.to) return `${b.from} → ${b.to}`;
      if (b.from) return `From ${b.from}`;
      if (b.to) return `Up to ${b.to}`;
      return 'All time';
    }
    default: return 'All time';
  }
}
