import { describe, it, expect } from 'vitest';
import { splitMultiIncidentEntry, splitAllMultiIncidents } from '@/lib/utils/incident-splitter';
import type { MockIncident } from '@/data/mock-incidents';

const KNOWN_TOWNS = ['Hoedspruit', 'Tzaneen', 'Polokwane', 'Mokopane', 'Vaalwater', 'Pretoria', 'Johannesburg'];

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
