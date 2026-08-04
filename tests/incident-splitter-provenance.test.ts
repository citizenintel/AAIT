import { describe, it, expect } from 'vitest';
import {
  splitAllMultiIncidents,
  parseCasualties,
} from '../apps/public-web/src/lib/utils/incident-splitter';
import { incidentFingerprint } from '../apps/public-web/src/lib/utils/deduplicate';
import type { MockIncident } from '../apps/public-web/src/data/mock-incidents';

const TOWNS = ['Bethlehem', 'Mokopane', 'Centurion'];
const geo = () => null;

function parent(id: string, summary: string, extra: Partial<MockIncident> = {}): MockIncident {
  return {
    id, title: 'Parent title', summary,
    module: 'ait', category: 'x', severity: 'critical',
    verification: 'v3_corroborated', locationTier: 'l3_area',
    lng: 28, lat: -26, province: 'Free State', town: 'Bethlehem',
    dateOccurred: '2004-06-16', dateReported: '2004-06-17',
    sourceCount: 1, sources: [], tags: [], isSynthetic: false,
    victimName: 'Column Sourced Victim',
    casualties: { deceased: 3, injured: 1 },
    ...extra,
  };
}

const REDACTED = [
  '[name withheld]. Murdered on the farm at Bethlehem. 16 June 2004.',
  '[name withheld]. Shot on a plot near Bethlehem. 14 April 2005.',
].join('\n');

describe('blocker probes', () => {
  it('split products get distinct fingerprints even when nameless + same town/date', () => {
    const a = parent('rowA', REDACTED);
    const b = parent('rowB', REDACTED);
    const out = splitAllMultiIncidents([a, b], TOWNS, geo).result;
    const fps = new Set(out.map(i => incidentFingerprint(i.title, i.dateOccurred ?? '', i.town ?? '')));
    console.log('products', out.length, 'distinct fingerprints', fps.size);
    console.log(out.map(i => i.title));
    expect(fps.size).toBe(out.length);
  });

  it('parent victimName / title / summary survive on splitFrom', () => {
    const out = splitAllMultiIncidents([parent('rowA', REDACTED)], TOWNS, geo).result;
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) {
      expect(c.splitFrom?.parentVictimName).toBe('Column Sourced Victim');
      expect(c.splitFrom?.parentTitle).toBe('Parent title');
      expect(c.splitFrom?.parentSummary).toBe(REDACTED);
      expect(c.splitFrom?.parentCasualties).toEqual({ deceased: 3, injured: 1 });
      expect(c.inferredFields).toContain('casualties:unassigned');
    }
  });

  it('parseCasualties never asserts a zero it was not told', () => {
    expect(parseCasualties('2 injured in the crash')).toEqual({ injured: 2 });
    expect(parseCasualties('3 killed')).toEqual({ deceased: 3 });
    expect(parseCasualties('nothing numeric here')).toBeUndefined();
  });

  it('word count is conserved across the split', () => {
    const src = parent('rowA', REDACTED);
    const out = splitAllMultiIncidents([src], TOWNS, geo).result;
    const before = src.summary.split(/\s+/).filter(Boolean).sort().join(' ');
    const after = out.map(i => i.summary).join(' ').split(/\s+/).filter(Boolean).sort().join(' ');
    expect(after).toBe(before);
  });

  it('semicolon strategy keeps its delimiters', () => {
    const s = 'MOSTERT Susan murdered at Bethlehem farm on 16 June 2004; '
      + 'PRETORIUS Hannes shot at Mokopane farm on 14 April 2005; '
      + 'BOTHA Marie assaulted at Centurion plot on 3 May 2006';
    const src = parent('rowS', s, { victimName: undefined, casualties: undefined });
    const out = splitAllMultiIncidents([src], TOWNS, geo).result;
    const semis = out.map(i => i.summary).join('').split(';').length - 1;
    console.log('strategy', out[0]?.splitFrom?.strategy, 'children', out.length, 'semicolons kept', semis);
    expect(semis).toBe(2);
  });
});
