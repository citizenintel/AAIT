import { describe, it, expect } from 'vitest';
import {
  normalizeIncidentDate,
  toIsoDay,
  isUndated,
  resolveBounds,
  overlaps,
  matchesWindow,
  applyTimeFilter,
  computeExtent,
  describeFilter,
  isTimeFilter,
  isBounded,
  shiftDays,
  shiftMonths,
  todayIsoDay,
  ALL_TIME,
  type TimeFilter,
  type DateBounds,
} from '@/lib/utils/time-filter';
import { MOCK_INCIDENTS, type MockIncident } from '@/data/mock-incidents';

const getDate = (i: MockIncident) => i.dateOccurred;

function boundsFor(f: TimeFilter, today?: string): DateBounds {
  return today ? resolveBounds(f, today) : resolveBounds(f);
}

// ---------------------------------------------------------------------------
// The normaliser is total
// ---------------------------------------------------------------------------

describe('normalizeIncidentDate — never throws, never NaN, never Invalid Date', () => {
  const junk: unknown[] = [
    '', '   ', null, undefined, 'unknown', '?', 'n/a', 'onbekend', '-',
    'circa the late nineties', 'TBC', NaN, Infinity, -Infinity,
    {}, [], [1, 2, 3], true, false, Symbol('x'), () => {}, 0, -1,
    new Date('nope'), '0000-00-00', '2000-13-01', '2000-02-30', '12/05/200',
  ];

  for (const v of junk) {
    it(`handles ${String(typeof v === 'symbol' ? 'Symbol()' : v)} without throwing`, () => {
      const out = normalizeIncidentDate(v);
      expect(() => JSON.stringify(out)).not.toThrow();
      if (out.kind !== 'none') {
        // If it did resolve, the bounds must be well-formed strings, never NaN.
        expect(out.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(out.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(out.start).not.toContain('NaN');
        expect(out.end).not.toContain('NaN');
      }
    });
  }

  it("'', null and undefined are all kind 'none'", () => {
    expect(normalizeIncidentDate('').kind).toBe('none');
    expect(normalizeIncidentDate(null).kind).toBe('none');
    expect(normalizeIncidentDate(undefined).kind).toBe('none');
    expect(isUndated('')).toBe(true);
    expect(isUndated(null)).toBe(true);
    expect(isUndated(undefined)).toBe(true);
  });

  it('garbage strings are kind none, not a guessed date', () => {
    for (const g of ['unknown', '?', 'n/a', 'sometime in the 90s', 'xx/xx/xxxx']) {
      expect(normalizeIncidentDate(g).kind).toBe('none');
    }
  });

  it('never produces a comparable value containing NaN for any junk input', () => {
    // A `none` may echo the raw text (that is its whole job — disclosure), but a
    // value that will be COMPARED must never contain NaN: a NaN bound silently
    // fails every comparison and drops the record.
    for (const v of junk) {
      const out = normalizeIncidentDate(v);
      if (out.kind === 'none') continue;
      expect(JSON.stringify(out)).not.toContain('NaN');
    }
  });
});

// ---------------------------------------------------------------------------
// Day precision
// ---------------------------------------------------------------------------

describe('normalizeIncidentDate — day precision', () => {
  it("plain 'YYYY-MM-DD'", () => {
    expect(normalizeIncidentDate('2000-05-12')).toEqual({
      kind: 'day', start: '2000-05-12', end: '2000-05-12',
    });
    expect(toIsoDay('2000-05-12')).toBe('2000-05-12');
  });

  it('full ISO timestamps slice to the calendar day', () => {
    expect(toIsoDay('2000-05-12T00:00:00+00:00')).toBe('2000-05-12');
    expect(toIsoDay('2026-07-22T10:00:00+00:00')).toBe('2026-07-22');
    expect(toIsoDay('2026-07-22T10:00:00.123Z')).toBe('2026-07-22');
    expect(toIsoDay('1998-11-03T23:59:59Z')).toBe('1998-11-03');
  });

  it('unpadded Y/M/D', () => {
    expect(toIsoDay('2000/5/12')).toBe('2000-05-12');
    expect(toIsoDay('2000-5-2')).toBe('2000-05-02');
  });

  it("D/M/Y is read the South African way — '12/05/2000' is 12 May", () => {
    expect(toIsoDay('12/05/2000')).toBe('2000-05-12');
    expect(toIsoDay('12-05-2000')).toBe('2000-05-12');
    expect(toIsoDay('1.5.2000')).toBe('2000-05-01');
  });

  it('two-digit years pivot at 50', () => {
    expect(toIsoDay('12/05/99')).toBe('1999-05-12');
    expect(toIsoDay('12/05/05')).toBe('2005-05-12');
  });

  it('word months, English and Afrikaans, either order', () => {
    expect(toIsoDay('12 May 2000')).toBe('2000-05-12');
    expect(toIsoDay('12 Mei 2000')).toBe('2000-05-12');
    expect(toIsoDay('3 Desember 1998')).toBe('1998-12-03');
    expect(toIsoDay('May 12, 2000')).toBe('2000-05-12');
    expect(toIsoDay('Aug. 9, 2001')).toBe('2001-08-09');
  });

  it('Excel/LibreOffice serials', () => {
    // Anchors: serial 25569 = 1970-01-01, serial 36526 = 2000-01-01.
    expect(toIsoDay('36526')).toBe('2000-01-01');
    expect(toIsoDay('36658')).toBe('2000-05-12');
    expect(toIsoDay(36658)).toBe('2000-05-12');
  });

  it("a bare '2000' is a YEAR, never an Excel serial", () => {
    const n = normalizeIncidentDate('2000');
    expect(n.kind).toBe('year');
    expect(toIsoDay('2000')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Calendar validity, leap day, malformed years
// ---------------------------------------------------------------------------

describe('calendar validity', () => {
  it('accepts a real leap day', () => {
    expect(toIsoDay('2000-02-29')).toBe('2000-02-29');
    expect(toIsoDay('29/02/2000')).toBe('2000-02-29');
    expect(toIsoDay('2024-02-29')).toBe('2024-02-29');
    expect(toIsoDay('29 February 2024')).toBe('2024-02-29');
  });

  it('rejects a leap day in a non-leap year — including the 100/400 rule', () => {
    expect(normalizeIncidentDate('1900-02-29').kind).toBe('none'); // divisible by 100
    expect(normalizeIncidentDate('2023-02-29').kind).toBe('none');
    expect(normalizeIncidentDate('2100-02-29').kind).toBe('none');
    expect(normalizeIncidentDate('29/02/2023').kind).toBe('none');
  });

  it('rejects impossible months and days rather than rolling them over', () => {
    expect(normalizeIncidentDate('2000-13-01').kind).toBe('none');
    expect(normalizeIncidentDate('2000-00-10').kind).toBe('none');
    expect(normalizeIncidentDate('2000-04-31').kind).toBe('none');
    expect(normalizeIncidentDate('2000-02-30').kind).toBe('none');
    expect(normalizeIncidentDate('2000-01-32').kind).toBe('none');
  });

  it("a 3-digit OCR-truncated year is REJECTED, not landed inside a 2000s window", () => {
    // '200-05-12' sorts AFTER every 19xx date and just before '2000-…', so
    // accepting it would produce a fabricated hit, not a visible miss.
    expect(normalizeIncidentDate('12/05/200').kind).toBe('none');
    expect(normalizeIncidentDate('200-05-12').kind).toBe('none');
    const r = applyTimeFilter(
      [{ d: '12/05/200' }],
      (x) => x.d,
      boundsFor({ mode: 'year', year: 2000 }),
      false,
    );
    expect(r.matched).toHaveLength(0);
    expect(r.undatedCount).toBe(1);
  });

  it('rejects years outside 1800..2200', () => {
    expect(normalizeIncidentDate('1234-05-06').kind).toBe('none');
    expect(normalizeIncidentDate('3000').kind).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Reduced precision — the point of interval matching
// ---------------------------------------------------------------------------

describe('reduced precision becomes an interval, never a fabricated day', () => {
  it("'2000' spans the whole year", () => {
    expect(normalizeIncidentDate('2000')).toEqual({
      kind: 'year', start: '2000-01-01', end: '2000-12-31',
    });
  });

  it("'Mei 2000' / '2000-05' span the whole month, including its real length", () => {
    expect(normalizeIncidentDate('Mei 2000')).toEqual({
      kind: 'month', start: '2000-05-01', end: '2000-05-31',
    });
    expect(normalizeIncidentDate('2000-05')).toEqual({
      kind: 'month', start: '2000-05-01', end: '2000-05-31',
    });
    expect(normalizeIncidentDate('February 2000').end).toBe('2000-02-29');
    expect(normalizeIncidentDate('February 2023').end).toBe('2023-02-28');
  });

  it("a year-only '2000' record MATCHES a year:2000 filter", () => {
    const b = boundsFor({ mode: 'year', year: 2000 });
    expect(overlaps(normalizeIncidentDate('2000'), b)).toBe(true);
    expect(matchesWindow('2000', b, false)).toBe(true);
  });

  it("a year-only '2000' record does NOT match year:1999 or year:2001", () => {
    expect(matchesWindow('2000', boundsFor({ mode: 'year', year: 1999 }), false)).toBe(false);
    expect(matchesWindow('2000', boundsFor({ mode: 'year', year: 2001 }), false)).toBe(false);
  });

  it("a year-only '2000' record is NEVER in the undated bucket", () => {
    const r = applyTimeFilter(
      [{ d: '2000' }],
      (x) => x.d,
      boundsFor({ mode: 'year', year: 2000 }),
      false,
    );
    expect(r.matched).toHaveLength(1);
    expect(r.undatedCount).toBe(0);
  });

  it("a month-only 'Mei 2000' record overlaps a range that touches only part of May", () => {
    expect(matchesWindow('Mei 2000', { from: '2000-05-30', to: '2000-06-10' }, false)).toBe(true);
    expect(matchesWindow('Mei 2000', { from: '2000-06-01', to: '2000-06-10' }, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Year boundaries
// ---------------------------------------------------------------------------

describe('year boundaries are inclusive on both ends', () => {
  const b = boundsFor({ mode: 'year', year: 2000 });

  it('resolves to 1 Jan .. 31 Dec', () => {
    expect(b).toEqual({ from: '2000-01-01', to: '2000-12-31' });
  });

  it('includes both edges', () => {
    expect(matchesWindow('2000-01-01', b, false)).toBe(true);
    expect(matchesWindow('2000-12-31', b, false)).toBe(true);
  });

  it('excludes the days either side', () => {
    expect(matchesWindow('1999-12-31', b, false)).toBe(false);
    expect(matchesWindow('2001-01-01', b, false)).toBe(false);
  });

  it('a timestamped record on the last day of the window is INCLUDED', () => {
    // The regression the 10-char slice exists to prevent:
    // '2026-07-22T10:00:00+00:00' <= '2026-07-22' is FALSE as a raw string compare.
    expect('2026-07-22T10:00:00+00:00' <= '2026-07-22').toBe(false);
    expect(matchesWindow('2026-07-22T10:00:00+00:00', { from: null, to: '2026-07-22' }, false))
      .toBe(true);
    expect(matchesWindow('2026-07-22T23:59:59Z', { from: '2026-07-22', to: '2026-07-22' }, false))
      .toBe(true);
  });

  it('custom range bounds are inclusive on both ends', () => {
    const r = boundsFor({ mode: 'range', from: '2026-07-14', to: '2026-07-16' });
    expect(matchesWindow('2026-07-14', r, false)).toBe(true);
    expect(matchesWindow('2026-07-16', r, false)).toBe(true);
    expect(matchesWindow('2026-07-13', r, false)).toBe(false);
    expect(matchesWindow('2026-07-17', r, false)).toBe(false);
  });

  it('a reversed custom range is swapped, not turned into an empty window', () => {
    expect(boundsFor({ mode: 'range', from: '2026-07-16', to: '2026-07-14' }))
      .toEqual({ from: '2026-07-14', to: '2026-07-16' });
  });

  it('an open-ended range is honoured on the bounded side only', () => {
    expect(boundsFor({ mode: 'range', from: '2000-01-01', to: null }))
      .toEqual({ from: '2000-01-01', to: null });
    expect(matchesWindow('2199-01-01', { from: '2000-01-01', to: null }, false)).toBe(true);
    expect(matchesWindow('1999-12-31', { from: '2000-01-01', to: null }, false)).toBe(false);
  });

  it('a malformed range value is ignored rather than emptying the map', () => {
    expect(boundsFor({ mode: 'range', from: 'garbage', to: null }))
      .toEqual({ from: null, to: null });
  });
});

// ---------------------------------------------------------------------------
// Undated inclusion / exclusion
// ---------------------------------------------------------------------------

describe('undated records are never silently dropped', () => {
  const items = [
    { id: 'a', d: '2000-05-12' },
    { id: 'b', d: '' },
    { id: 'c', d: '2026-07-15' },
    { id: 'd', d: 'unknown' },
  ];

  it('all time includes everything, undated included, and still counts them', () => {
    const r = applyTimeFilter(items, (x) => x.d, boundsFor(ALL_TIME), false);
    expect(r.matched).toHaveLength(4);
    expect(r.undatedCount).toBe(2);
    expect(r.undatedIncluded).toBe(true);
    expect(r.outOfRangeCount).toBe(0);
  });

  it('bounded window with includeUndated:true keeps them and counts them', () => {
    const r = applyTimeFilter(items, (x) => x.d, boundsFor({ mode: 'year', year: 2000 }), true);
    expect(r.matched.map((x) => x.id).sort()).toEqual(['a', 'b', 'd']);
    expect(r.undatedCount).toBe(2);
    expect(r.undatedIncluded).toBe(true);
    expect(r.outOfRangeCount).toBe(1); // only 'c'
  });

  it('bounded window with includeUndated:false excludes them but still counts them', () => {
    const r = applyTimeFilter(items, (x) => x.d, boundsFor({ mode: 'year', year: 2000 }), false);
    expect(r.matched.map((x) => x.id)).toEqual(['a']);
    expect(r.undatedCount).toBe(2);
    expect(r.undatedIncluded).toBe(false);
    expect(r.outOfRangeCount).toBe(1);
  });

  it('every input record is accounted for in exactly one bucket', () => {
    for (const inc of [true, false]) {
      const r = applyTimeFilter(items, (x) => x.d, boundsFor({ mode: 'year', year: 2000 }), inc);
      const dated = r.totalCount - r.undatedCount;
      const inRangeDated = inc ? r.inRangeCount - r.undatedCount : r.inRangeCount;
      expect(inRangeDated + r.outOfRangeCount).toBe(dated);
      expect(r.totalCount).toBe(items.length);
    }
  });

  it('an undated record is never removed by a comparison — only by explicit choice', () => {
    // overlaps() is the ONLY removal predicate, and it is never reached for
    // kind:'none'. Proven by the fact that flipping the flag is the only thing
    // that changes the outcome for an undated record.
    const one = [{ d: '' }];
    expect(applyTimeFilter(one, (x) => x.d, { from: '1900-01-01', to: '1900-12-31' }, true).matched)
      .toHaveLength(1);
    expect(applyTimeFilter(one, (x) => x.d, { from: '1900-01-01', to: '1900-12-31' }, false).matched)
      .toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The 23 mock incidents
// ---------------------------------------------------------------------------

describe('the 23 shipped mock incidents', () => {
  it('there are 23 and every one has a day-precise date', () => {
    expect(MOCK_INCIDENTS).toHaveLength(23);
    for (const i of MOCK_INCIDENTS) {
      expect(normalizeIncidentDate(i.dateOccurred).kind).toBe('day');
    }
  });

  it('All time publishes all 23', () => {
    const r = applyTimeFilter(MOCK_INCIDENTS, getDate, boundsFor(ALL_TIME), true);
    expect(r.matched).toHaveLength(23);
    expect(r.inRangeCount).toBe(23);
    expect(r.undatedCount).toBe(0);
  });

  it('year 2026 publishes all 23', () => {
    const r = applyTimeFilter(MOCK_INCIDENTS, getDate, boundsFor({ mode: 'year', year: 2026 }), true);
    expect(r.inRangeCount).toBe(23);
    expect(r.outOfRangeCount).toBe(0);
  });

  it('year 2000 publishes none, and says so via outOfRangeCount', () => {
    const r = applyTimeFilter(MOCK_INCIDENTS, getDate, boundsFor({ mode: 'year', year: 2000 }), true);
    expect(r.inRangeCount).toBe(0);
    expect(r.outOfRangeCount).toBe(23);
    expect(r.undatedCount).toBe(0);
  });

  it('the custom range 2026-07-14 .. 2026-07-16 publishes exactly 5', () => {
    const r = applyTimeFilter(
      MOCK_INCIDENTS, getDate,
      boundsFor({ mode: 'range', from: '2026-07-14', to: '2026-07-16' }),
      true,
    );
    expect(r.inRangeCount).toBe(5);
  });

  it('computeExtent reports the real span and only the years present', () => {
    const e = computeExtent(MOCK_INCIDENTS, getDate);
    expect(e).not.toBeNull();
    expect(e!.minDay).toBe('2026-07-14');
    expect(e!.maxDay).toBe('2026-07-22');
    expect(e!.years).toEqual([2026]);
  });

  it('computeExtent returns null when nothing is dated', () => {
    expect(computeExtent([{ d: '' }, { d: 'unknown' }], (x) => x.d)).toBeNull();
  });

  it('a mixed historical + mock set exposes both years, newest first', () => {
    const mixed = [...MOCK_INCIDENTS.map(getDate), '2000-05-12', '1998', ''];
    const e = computeExtent(mixed, (x) => x);
    expect(e!.years).toEqual([2026, 2000, 1998]);
    expect(e!.minDay).toBe('1998-01-01');
    expect(e!.maxDay).toBe('2026-07-22');
  });
});

// ---------------------------------------------------------------------------
// Bound arithmetic
// ---------------------------------------------------------------------------

describe('resolveBounds / date arithmetic', () => {
  it('All time is unbounded and isBounded() says so', () => {
    expect(resolveBounds(ALL_TIME)).toEqual({ from: null, to: null });
    expect(isBounded(resolveBounds(ALL_TIME))).toBe(false);
    expect(isBounded({ from: null, to: '2000-01-01' })).toBe(true);
  });

  it('presets resolve against an injected today, not the wall clock', () => {
    expect(resolveBounds({ mode: 'preset', preset: 'last7' }, '2026-08-04'))
      .toEqual({ from: '2026-07-29', to: '2026-08-04' });
    expect(resolveBounds({ mode: 'preset', preset: 'last30' }, '2026-08-04'))
      .toEqual({ from: '2026-07-06', to: '2026-08-04' });
    expect(resolveBounds({ mode: 'preset', preset: 'last12m' }, '2026-08-04'))
      .toEqual({ from: '2025-08-05', to: '2026-08-04' });
    expect(resolveBounds({ mode: 'preset', preset: 'thisYear' }, '2026-08-04'))
      .toEqual({ from: '2026-01-01', to: '2026-08-04' });
  });

  it('shiftDays crosses month, year, DST and leap boundaries exactly', () => {
    expect(shiftDays('2026-03-29', -1)).toBe('2026-03-28'); // SA/EU DST weekend
    expect(shiftDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDays('2000-03-01', -1)).toBe('2000-02-29');
    expect(shiftDays('2023-03-01', -1)).toBe('2023-02-28');
    expect(shiftDays('2026-08-04', 0)).toBe('2026-08-04');
  });

  it('shiftMonths clamps the day to the target month length', () => {
    expect(shiftMonths('2026-08-04', -12)).toBe('2025-08-04');
    expect(shiftMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftMonths('2024-03-31', -1)).toBe('2024-02-29');
    expect(shiftMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('todayIsoDay uses the LOCAL calendar day, not UTC', () => {
    const d = new Date(2026, 7, 4, 23, 30, 0); // 4 Aug 2026 23:30 local
    expect(todayIsoDay(d)).toBe('2026-08-04');
    expect(todayIsoDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('an invalid year filter falls back to unbounded rather than emptying the map', () => {
    expect(resolveBounds({ mode: 'year', year: Number.NaN })).toEqual({ from: null, to: null });
    expect(resolveBounds({ mode: 'year', year: 99999 })).toEqual({ from: null, to: null });
  });
});

// ---------------------------------------------------------------------------
// Persistence guard + labels
// ---------------------------------------------------------------------------

describe('isTimeFilter — a corrupt persisted value can never hide the dataset', () => {
  it('accepts every legitimate shape', () => {
    expect(isTimeFilter({ mode: 'all' })).toBe(true);
    expect(isTimeFilter({ mode: 'preset', preset: 'last30' })).toBe(true);
    expect(isTimeFilter({ mode: 'year', year: 2000 })).toBe(true);
    expect(isTimeFilter({ mode: 'range', from: '2000-01-01', to: null })).toBe(true);
  });

  it('rejects everything else', () => {
    for (const v of [null, undefined, 0, '', 'all', {}, { mode: 'nope' },
                     { mode: 'preset', preset: 'yesterday' },
                     { mode: 'year', year: '2000' },
                     { mode: 'year', year: 99999 },
                     { mode: 'range', from: 5, to: null }]) {
      expect(isTimeFilter(v)).toBe(false);
    }
  });
});

describe('describeFilter', () => {
  it('labels every mode', () => {
    expect(describeFilter({ mode: 'all' })).toBe('All time');
    expect(describeFilter({ mode: 'preset', preset: 'last30' })).toBe('Last 30 days');
    expect(describeFilter({ mode: 'year', year: 2000 })).toBe('2000');
    expect(describeFilter({ mode: 'range', from: '2000-01-01', to: '2000-12-31' }))
      .toBe('2000-01-01 → 2000-12-31');
    expect(describeFilter({ mode: 'range', from: '2000-01-01', to: null }))
      .toBe('From 2000-01-01');
    expect(describeFilter({ mode: 'range', from: null, to: '2000-12-31' }))
      .toBe('Up to 2000-12-31');
    expect(describeFilter({ mode: 'range', from: null, to: null })).toBe('All time');
  });
});

// ---------------------------------------------------------------------------
// Real-shaped historical import
// ---------------------------------------------------------------------------

describe('a realistic OCR-shaped 1990s/2000s import', () => {
  const rows = [
    { id: '1', d: '12/05/2000' },      // 12 May 2000
    { id: '2', d: '2000' },            // year only
    { id: '3', d: 'Mei 2000' },        // month only
    { id: '4', d: '' },                // undated
    { id: '5', d: '03/11/1998' },
    { id: '6', d: '1998-11-03T00:00:00+00:00' },
    { id: '7', d: 'unknown' },
    { id: '8', d: '12/05/200' },       // OCR truncation
    { id: '9', d: '36658' },           // Excel serial -> 2000-05-12
  ];

  it('year 2000 catches day, month and year precision alike', () => {
    const r = applyTimeFilter(rows, (x) => x.d, boundsFor({ mode: 'year', year: 2000 }), false);
    expect(r.matched.map((x) => x.id).sort()).toEqual(['1', '2', '3', '9']);
    expect(r.undatedCount).toBe(3);    // '', 'unknown', and the truncated '12/05/200'
    expect(r.outOfRangeCount).toBe(2); // the two 1998 rows
  });

  it('the OCR-truncated year lands in the undated bucket, not inside 2000', () => {
    const r = applyTimeFilter(rows, (x) => x.d, boundsFor({ mode: 'year', year: 2000 }), true);
    expect(r.matched.map((x) => x.id)).toContain('8');
    expect(r.undatedCount).toBe(3); // '', 'unknown', '12/05/200'
  });

  it('year 1998 catches both the slash form and the ISO timestamp form', () => {
    const r = applyTimeFilter(rows, (x) => x.d, boundsFor({ mode: 'year', year: 1998 }), false);
    expect(r.matched.map((x) => x.id).sort()).toEqual(['5', '6']);
  });

  it('All time publishes every row including the unparseable ones', () => {
    const r = applyTimeFilter(rows, (x) => x.d, boundsFor(ALL_TIME), false);
    expect(r.matched).toHaveLength(rows.length);
  });

  it('the year list offered to the UI is exactly the years present', () => {
    expect(computeExtent(rows, (x) => x.d)!.years).toEqual([2000, 1998]);
  });
});
