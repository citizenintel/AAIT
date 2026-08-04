import { describe, it, expect } from 'vitest';
import {
  deduplicateByContent,
  deduplicateWithStats,
  incidentFingerprint,
  mockIncidentFingerprint,
} from '../apps/public-web/src/lib/utils/deduplicate';

/**
 * The blocker these tests lock down: content dedup used to remove records and
 * report nothing, and every count the UI showed was computed on the reduced
 * set. A real historical import — repeated short narratives, many undated rows
 * because the importer no longer fabricates dates — is exactly the input that
 * triggers it in bulk.
 */

interface Rec {
  id: string;
  summary?: string;
  title?: string;
  dateOccurred?: string;
  town?: string;
  province?: string;
}

const key = (r: Rec) => mockIncidentFingerprint(r);
const id = (r: Rec) => r.id;

describe('incidentFingerprint refuses to judge without evidence', () => {
  it('returns "" — not "||" — when the content field is empty', () => {
    expect(incidentFingerprint('', '', '')).toBe('');
    expect(incidentFingerprint('', '2000-01-01', 'Bethlehem')).toBe('');
  });

  it('still keys normally when content is present', () => {
    expect(incidentFingerprint('Attack', '2000-01-01', 'Bethlehem'))
      .toBe('attack|20000101|bethlehem');
  });
});

describe('mockIncidentFingerprint', () => {
  it('is "" when BOTH summary and title are empty, whatever the date/place', () => {
    expect(key({ id: 'a', summary: '', title: '', dateOccurred: '', town: '' })).toBe('');
    expect(key({ id: 'b', summary: '', title: '', dateOccurred: '', town: 'Bethlehem' })).toBe('');
  });

  it('separates records whose titles carry the splitter entry hash', () => {
    // incident-splitter.ts:549 stamps a content hash into the title precisely so
    // sibling fragments cannot collide. Keying on the summary alone would throw
    // that guarantee away.
    const a = { id: 'a', summary: 'Shot on a plot.', title: 'Unidentified - Bethlehem - entry 7f3a', town: 'Bethlehem' };
    const b = { id: 'b', summary: 'Shot on a plot.', title: 'Unidentified - Bethlehem - entry 91c2', town: 'Bethlehem' };
    expect(key(a)).not.toBe(key(b));
  });

  it('falls back to province when town is an empty string', () => {
    const a = { id: 'a', summary: 'Same text', town: '', province: 'Free State' };
    const b = { id: 'b', summary: 'Same text', town: '', province: 'Limpopo' };
    expect(key(a)).not.toBe(key(b));
  });
});

describe('deduplicateWithStats never removes a record without reporting it', () => {
  it('items.length + removedCount === input.length', () => {
    const input: Rec[] = [
      { id: '1', summary: 'Attack on farm', dateOccurred: '', town: 'Bethlehem' },
      { id: '2', summary: 'Attack on farm', dateOccurred: '', town: 'Bethlehem' },
      { id: '3', summary: 'Attack on farm', dateOccurred: '', town: 'Bethlehem' },
      { id: '4', summary: 'Different event', dateOccurred: '', town: 'Bethlehem' },
    ];
    const r = deduplicateWithStats(input, key, id);
    expect(r.items.length + r.removedCount).toBe(input.length);
    expect(r.mergedCount).toBe(2);
    expect(r.merged).toEqual([
      { droppedId: '2', keptId: '1' },
      { droppedId: '3', keptId: '1' },
    ]);
  });

  it('counts repeated ids separately from content merges', () => {
    const input: Rec[] = [
      { id: '1', summary: 'A', town: 'X' },
      { id: '1', summary: 'A', town: 'X' },
      { id: '2', summary: 'A', town: 'X' },
    ];
    const r = deduplicateWithStats(input, key, id);
    expect(r.duplicateIdCount).toBe(1);
    expect(r.mergedCount).toBe(1);
    expect(r.items.length + r.removedCount).toBe(3);
  });

  it('KEEPS every contentless record instead of collapsing them all into one', () => {
    // The pre-fix behaviour: fingerprint "||" is truthy, so these three became
    // one and two records ceased to exist anywhere in the app.
    const input: Rec[] = [
      { id: '1', summary: '', title: '', dateOccurred: '', town: '' },
      { id: '2', summary: '', title: '', dateOccurred: '', town: '' },
      { id: '3', summary: '', title: '', dateOccurred: '', town: '' },
    ];
    const r = deduplicateWithStats(input, key, id);
    expect(r.items).toHaveLength(3);
    expect(r.removedCount).toBe(0);
  });

  it('does not merge undated records that differ only in narrative', () => {
    const input: Rec[] = [
      { id: '1', summary: 'Farmer shot at the gate', dateOccurred: '', town: 'Bethlehem' },
      { id: '2', summary: 'Farmer shot in the house', dateOccurred: '', town: 'Bethlehem' },
    ];
    expect(deduplicateWithStats(input, key, id).items).toHaveLength(2);
  });

  it('deduplicateByContent stays a drop-in wrapper', () => {
    const input: Rec[] = [
      { id: '1', summary: 'A', town: 'X' },
      { id: '2', summary: 'A', town: 'X' },
    ];
    expect(deduplicateByContent(input, key, id)).toEqual(
      deduplicateWithStats(input, key, id).items,
    );
  });
});

describe('the record-accounting identity the provider publishes', () => {
  /** Mirrors useIncidentData: review gate, then dedup, then the counts. */
  function publish(api: Rec[], imported: (Rec & { needsReview?: boolean })[]) {
    const reviewed = imported.filter(i => !i.needsReview);
    const awaitingReview = imported.length - reviewed.length;
    const deduped = deduplicateWithStats([...api, ...reviewed], key, id);
    return {
      storedCount: api.length + imported.length,
      totalCount: deduped.items.length,
      mergedCount: deduped.removedCount,
      awaitingReview,
    };
  }

  it('storedCount === totalCount + mergedCount + awaitingReview', () => {
    const api: Rec[] = [
      { id: 'api-1', summary: 'Attack', dateOccurred: '2000-05-12', town: 'Bethlehem' },
    ];
    const imported = [
      { id: 'i-1', summary: 'Attack', dateOccurred: '2000-05-12', town: 'Bethlehem' },
      { id: 'i-2', summary: 'Other attack', dateOccurred: '', town: 'Bethlehem' },
      { id: 'i-3', summary: 'Held back', dateOccurred: '', town: '', needsReview: true },
      { id: 'i-4', summary: '', title: '', dateOccurred: '', town: '' },
    ];
    const p = publish(api, imported);
    expect(p.storedCount).toBe(5);
    expect(p.awaitingReview).toBe(1);
    expect(p.mergedCount).toBe(1); // i-1 duplicates api-1
    expect(p.totalCount).toBe(3);  // api-1, i-2, i-4 — the contentless row survives
    expect(p.storedCount).toBe(p.totalCount + p.mergedCount + p.awaitingReview);
  });

  it('holds for a 23-record historical batch with heavy repetition', () => {
    const imported: (Rec & { needsReview?: boolean })[] = [];
    for (let i = 0; i < 23; i++) {
      imported.push({
        id: `r-${i}`,
        // 5 distinct narratives across 23 rows and a third of them undated, so
        // rows i and i+15 share summary AND date and genuinely collide.
        summary: `Farm attack narrative ${i % 5}`,
        title: '',
        dateOccurred: i % 3 === 0 ? '' : '1998',
        town: 'Bethlehem',
      });
    }
    const p = publish([], imported);
    expect(p.storedCount).toBe(23);
    expect(p.mergedCount).toBeGreaterThan(0);
    expect(p.storedCount).toBe(p.totalCount + p.mergedCount + p.awaitingReview);
  });
});
