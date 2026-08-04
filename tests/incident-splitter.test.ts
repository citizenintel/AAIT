import { describe, it, expect } from 'vitest';
import { splitMultiIncidentEntry, splitAllMultiIncidents } from '@/lib/utils/incident-splitter';
import type { MockIncident } from '@/data/mock-incidents';

const KNOWN_TOWNS = ['Hoedspruit', 'Tzaneen', 'Polokwane', 'Mokopane', 'Vaalwater', 'Pretoria', 'Johannesburg', 'Brakpan', 'Magaliesburg'];

function mockGeocode(town: string, _province: string) {
  return { lat: -25.0, lng: 28.0 };
}

function makeIncident(overrides: Partial<MockIncident> = {}): MockIncident {
  return {
    id: 'test-1',
    title: 'Test Incident — Hoedspruit',
    summary: 'Test summary',
    module: 'ait',
    category: 'farm_attack',
    severity: 'critical',
    verification: 'v1_unverified',
    locationTier: 'l3_area',
    lng: 30.97,
    lat: -24.35,
    province: 'Limpopo',
    town: 'Hoedspruit',
    dateOccurred: '2020-03-15',
    dateReported: '2020-03-16',
    sourceCount: 1,
    sources: [],
    tags: [],
    isSynthetic: false,
    ...overrides,
  };
}

describe('splitMultiIncidentEntry', () => {
  it('returns single incident unchanged when no splitting needed', () => {
    const inc = makeIncident({ summary: 'Jan van Niekerk was attacked on his farm near Hoedspruit on 15 March 2020.' });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('test-1');
  });

  it('splits newline-separated entries with different dates', () => {
    const inc = makeIncident({
      summary: [
        'Jan van Niekerk killed on farm near Hoedspruit on 15 March 2020',
        'Pieter Botha attacked in Tzaneen on 22 April 2020',
        'Marie du Plessis shot near Mokopane on 10 May 2020',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('splits entries with different locations same date', () => {
    const inc = makeIncident({
      summary: [
        'Jan van Niekerk killed near Hoedspruit on 15 March 2020',
        'Pieter Botha killed in Tzaneen on 15 March 2020',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result.length).toBe(2);
  });

  it('keeps entries with same date and same location as one incident', () => {
    const inc = makeIncident({
      summary: [
        'Jan van Niekerk killed near Hoedspruit on 15 March 2020',
        'Anna van Niekerk injured near Hoedspruit on 15 March 2020',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result).toHaveLength(1);
  });

  it('splits numbered list entries', () => {
    const inc = makeIncident({
      summary: [
        '1. Jan van Niekerk, 15 March 2020, Hoedspruit - killed',
        '2. Pieter Botha, 22 April 2020, Tzaneen - attacked',
        '3. Marie du Plessis, 10 May 2020, Polokwane - robbed',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('handles Afrikaans date formats', () => {
    const inc = makeIncident({
      summary: [
        'Jan van Niekerk murdered near Hoedspruit on 15 Maart 2020',
        'Pieter Botha attacked in Tzaneen on 22 April 2020',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result.length).toBe(2);
  });

  it('preserves parent fields in split incidents', () => {
    const inc = makeIncident({
      id: 'parent-1',
      province: 'Limpopo',
      module: 'ait',
      severity: 'critical',
      summary: [
        'Jan van Niekerk killed near Hoedspruit on 15 March 2020',
        'Pieter Botha attacked in Tzaneen on 22 April 2020',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    for (const r of result) {
      expect(r.province).toBe('Limpopo');
      expect(r.module).toBe('ait');
      expect(r.severity).toBe('critical');
      expect(r.id).toContain('parent-1');
    }
  });

  it('splits ALL-CAPS surname entries (farm attack list format)', () => {
    const inc = makeIncident({
      summary: [
        'MOSTERT Susan. Assaulted & Shot. Witkoppies farm, Hoedspruit.',
        'MEYBURGH Maria. Murdered. Maryvlei smallholding. Brakpan. 16 June 2004',
        'PRETORIUS Hannes. Shot. Kosterfontein farm. 14 Apr 2004.',
        'THERON Richard. Murdered. Kosterfontein farm, Magaliesburg. 9 June 2004',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('handles month-year dates without day (July 2004)', () => {
    const inc = makeIncident({
      summary: [
        'SERFONTEIN Chris. Murdered. Vaalrivier. July 2004.',
        'PRETORIUS Hannes. Shot. Kosterfontein farm. Apr 2004.',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('fixes OCR split years (200 4 → 2004)', () => {
    const inc = makeIncident({
      summary: [
        'MEYBURGH Maria. Murdered. Brakpan. 16 Junie 200 4',
        'PRETORIUS Hannes. Shot. Hoedspruit. 14 Apr 200 4.',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // After OCR fix, dates should be parsed correctly
    const dates = result.map(r => r.dateOccurred).filter(d => d && d.includes('2004'));
    expect(dates.length).toBeGreaterThanOrEqual(1);
  });

  it('joins continuation lines that do not start with ALL-CAPS', () => {
    // NOTE: the NAUDE line now carries a date. Under the evidence gate an entry
    // with no date is treated as a continuation of its neighbour, not as a
    // separately-recordable incident, so the original dateless fixture
    // (correctly) collapses to 1.
    const inc = makeIncident({
      summary: [
        'MEYBURGH Maria. Murdered. Maryvlei smallholding. Brakpan. 16',
        'Junie 2004',
        'NAUDE SG. Murdered. Olyfenkloof farm, Magaliesburg. 4 Julie 2004.',
      ].join('\n'),
    });
    const result = splitMultiIncidentEntry(inc, KNOWN_TOWNS, mockGeocode);
    // "Junie 2004" should be joined to MEYBURGH line, giving 2 entries
    expect(result.length).toBeGreaterThanOrEqual(2);
    // and the wrapped continuation line must not have been discarded
    expect(result.map(r => r.summary).join(' ')).toContain('Junie 2004');
  });
});

describe('splitAllMultiIncidents', () => {
  it('reports correct split count', () => {
    const incidents = [
      makeIncident({ id: 'single', summary: 'Simple single incident' }),
      makeIncident({
        id: 'multi',
        summary: 'Jan van Niekerk killed near Hoedspruit on 15 March 2020\nPieter Botha attacked in Tzaneen on 22 April 2020',
      }),
    ];
    const { result, splitCount, newTotal } = splitAllMultiIncidents(incidents, KNOWN_TOWNS, mockGeocode);
    expect(splitCount).toBe(1);
    expect(newTotal).toBeGreaterThan(2);
    expect(result.length).toBe(newTotal);
  });
});
