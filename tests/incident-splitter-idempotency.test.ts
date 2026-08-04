import { describe, it, expect } from 'vitest';
import {
  splitAllMultiIncidents,
  splitMultiIncidentEntry,
  MAX_SPLIT_FACTOR,
} from '@/lib/utils/incident-splitter';
import type { MockIncident } from '@/data/mock-incidents';

const KNOWN_TOWNS = [
  'Hoedspruit', 'Tzaneen', 'Polokwane', 'Mokopane', 'Vaalwater',
  'Pretoria', 'Johannesburg', 'Brakpan', 'Magaliesburg', 'Bethlehem', 'Jamestown',
];

const geo = () => ({ lat: -25.0, lng: 28.0 });

const mk = (o: Partial<MockIncident> = {}): MockIncident => ({
  id: 'r', title: 'T', summary: '', module: 'ait', category: 'farm_attack',
  severity: 'critical', verification: 'v1_unverified', locationTier: 'l3_area',
  lng: 30, lat: -24, province: 'Limpopo', town: 'Hoedspruit',
  dateOccurred: '2020-03-15', dateReported: '2020-03-16',
  sourceCount: 1, sources: [], tags: [], isSynthetic: false, ...o,
});

const pass = (l: MockIncident[]) => splitAllMultiIncidents(l, KNOWN_TOWNS, geo).result;

describe('incident-splitter — idempotency (A)', () => {
  it('split(split(X)) === split(X) for rows carrying an incident date and a court date', () => {
    const inc = mk({
      summary: [
        'Jan van Niekerk murdered near Hoedspruit on 15 March 2020. Accused convicted 2 February 2021.',
        'Pieter Botha murdered near Tzaneen on 22 April 2020. Accused convicted 1 April 2021.',
        'Marie du Plessis murdered near Mokopane on 10 May 2020. Accused convicted 7 July 2021.',
      ].join('\n'),
    });

    let cur = [inc];
    const trace: number[] = [1];
    for (let i = 0; i < 5; i++) {
      cur = pass(cur);
      trace.push(cur.length);
    }
    // Every pass after the first must produce the identical count.
    expect(new Set(trace.slice(1)).size).toBe(1);
  });

  it('re-running a batch does not change ids', () => {
    const inc = mk({
      summary: [
        'Jan van Niekerk murdered near Hoedspruit on 15 March 2020.',
        'Pieter Botha murdered near Tzaneen on 22 April 2020.',
      ].join('\n'),
    });
    const a = pass([inc]).map(x => x.id).sort();
    const b = pass([inc]).map(x => x.id).sort();
    expect(a).toEqual(b);
    expect(a.length).toBe(2);
  });

  it('already-split products are skipped and counted', () => {
    const inc = mk({
      summary: [
        'Jan van Niekerk murdered near Hoedspruit on 15 March 2020.',
        'Pieter Botha murdered near Tzaneen on 22 April 2020.',
      ].join('\n'),
    });
    const first = splitAllMultiIncidents([inc], KNOWN_TOWNS, geo);
    expect(first.skipped).toBe(0);
    const second = splitAllMultiIncidents(first.result, KNOWN_TOWNS, geo);
    expect(second.skipped).toBe(first.result.length);
    expect(second.splitCount).toBe(0);
    expect(second.newTotal).toBe(first.newTotal);
  });
});

describe('incident-splitter — over-split guardrails (B)', () => {
  it('prose with an incident date plus a court date is NOT split', () => {
    const inc = mk({
      summary: 'Pieter Botha murdered near Bethlehem on 16 June 2004. Accused convicted 2 February 2005.',
    });
    const r = splitMultiIncidentEntry(inc, KNOWN_TOWNS, geo);
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe('r');
  });

  it('a 40-record master-list row is capped and loses no source text', () => {
    const lines: string[] = [];
    for (let i = 1; i <= 40; i++) {
      lines.push(`Victim Number${i} was murdered on the farm near Hoedspruit on ${(i % 28) + 1} March 2004.`);
    }
    const inc = mk({ id: 'big', summary: lines.join('\n') });

    let cur = [inc];
    for (let i = 0; i < 4; i++) cur = pass(cur);

    expect(cur.length).toBeLessThanOrEqual(MAX_SPLIT_FACTOR);
    const totalText = cur.map(c => c.summary).join(' ');
    expect(lines.every(l => totalText.includes(l))).toBe(true);
    expect(cur.every(c => c.needsReview === true)).toBe(true);
  });

  it('short fragments are merged into a neighbour, not promoted', () => {
    const inc = mk({
      summary: [
        'Jan van Niekerk murdered near Hoedspruit on 15 March 2020.',
        'Later.',
        'Pieter Botha murdered near Tzaneen on 22 April 2020.',
      ].join('\n'),
    });
    const r = splitMultiIncidentEntry(inc, KNOWN_TOWNS, geo);
    expect(r).toHaveLength(2);
    expect(r.map(x => x.summary).join(' ')).toContain('Later.');
  });

  it('batch result reports an honest before/after', () => {
    const b = splitAllMultiIncidents(
      [
        mk({ id: 'a', summary: 'Simple single incident with no structure at all here.' }),
        mk({
          id: 'b',
          summary: 'Jan van Niekerk murdered near Hoedspruit on 15 March 2020.\nPieter Botha murdered near Tzaneen on 22 April 2020.',
        }),
      ],
      KNOWN_TOWNS,
      geo,
    );
    expect(b.originalTotal).toBe(2);
    expect(b.newTotal).toBe(b.result.length);
    expect(b.factor).toBeCloseTo(b.newTotal / 2);
    expect(b.exceedsBatchLimit).toBe(false);
    expect(b.worstOffenders[0]!.id).toBe('b');
  });
});

describe('incident-splitter — no fabrication (E)', () => {
  it('does not invent or divide casualties', () => {
    const inc = mk({
      casualties: { deceased: 1, injured: 0 },
      summary: [
        'Jan van Niekerk murdered near Hoedspruit on 15 March 2020',
        'Pieter Botha murdered near Tzaneen on 22 April 2020',
        'Marie du Plessis murdered near Mokopane on 10 May 2020',
      ].join('\n'),
    });
    const r = splitMultiIncidentEntry(inc, KNOWN_TOWNS, geo);
    const total = r.reduce((a, x) => a + (x.casualties?.deceased ?? 0), 0);
    expect(total).toBe(0);
    expect(r.every(x => x.inferredFields?.includes('casualties:unassigned'))).toBe(true);
    expect(r.every(x => x.splitFrom?.parentCasualties?.deceased === 1)).toBe(true);
  });

  it('keeps explicitly stated numeric casualties', () => {
    const inc = mk({
      summary: [
        'An attack near Hoedspruit on 15 March 2020 in which 2 killed and 1 injured.',
        'An attack near Tzaneen on 22 April 2020 in which 3 killed were reported.',
      ].join('\n'),
    });
    const r = splitMultiIncidentEntry(inc, KNOWN_TOWNS, geo);
    expect(r.some(x => x.casualties?.deceased === 2 && x.casualties?.injured === 1)).toBe(true);
  });

  it('does not un-redact withheld names', () => {
    const inc = mk({
      summary: [
        'MOSTERT [name withheld] was murdered on the farm near Hoedspruit on 3 March 2004.',
        'BEZUIDENHOUT [name withheld] was murdered near Tzaneen on 9 April 2004.',
      ].join('\n'),
    });
    const r = splitMultiIncidentEntry(inc, KNOWN_TOWNS, geo);
    expect(r.every(x => !/mostert|bezuidenhout/i.test(x.title))).toBe(true);
    expect(r.every(x => x.victimName === undefined)).toBe(true);
  });

  it('does not emit province names as victims', () => {
    const inc = mk({
      summary: [
        'Attack in the Western Cape near the Free State border on 1 March 2020 at Pretoria.',
        'Eastern Cape and Northern Cape farms affected on 5 April 2020 near Tzaneen.',
      ].join('\n'),
    });
    const r = splitMultiIncidentEntry(inc, KNOWN_TOWNS, geo);
    expect(r.every(x => !/cape|state/i.test(x.victimName ?? ''))).toBe(true);
  });

  it('every split product carries provenance and needsReview', () => {
    const inc = mk({
      id: 'parent-9',
      summary: [
        'Jan van Niekerk murdered near Hoedspruit on 15 March 2020.',
        'Pieter Botha murdered near Tzaneen on 22 April 2020.',
      ].join('\n'),
    });
    const r = splitMultiIncidentEntry(inc, KNOWN_TOWNS, geo);
    for (const x of r) {
      expect(x.needsReview).toBe(true);
      expect(x.splitFrom?.rootId).toBe('parent-9');
      expect(x.splitFrom?.parentId).toBe('parent-9');
      expect(x.splitFrom?.generation).toBe(1);
      expect(x.id.startsWith('parent-9-s')).toBe(true);
    }
  });
});
