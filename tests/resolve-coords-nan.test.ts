import { describe, it, expect } from 'vitest';
import { resolveCoords } from '../apps/public-web/src/lib/utils/sa-coordinates';

describe('resolveCoords — NaN rejection (regression: map showed ~7 of 5396 dots)', () => {
  it('rejects NaN coordinates instead of passing them through', () => {
    // The old guard was `inc.lng != null && inc.lat != null`, and NaN != null
    // is TRUE, so NaN coordinates were returned verbatim. MapLibre then dropped
    // those features silently while the badge still counted them.
    const r = resolveCoords({ lng: NaN, lat: NaN, town: null, province: null });
    expect(r).toBeNull();
  });

  it('falls through to the province centroid when coords are NaN', () => {
    // Critical: NaN used to short-circuit at the lng/lat branch, so an incident
    // with a valid province never reached the province fallback at all.
    const r = resolveCoords({ lng: NaN, lat: NaN, town: null, province: 'Limpopo' });
    expect(r).not.toBeNull();
    expect(Number.isFinite(r!.lng)).toBe(true);
    expect(Number.isFinite(r!.lat)).toBe(true);
  });

  it('rejects Infinity', () => {
    expect(resolveCoords({ lng: Infinity, lat: -28, town: null, province: null })).toBeNull();
    expect(resolveCoords({ lng: 25, lat: -Infinity, town: null, province: null })).toBeNull();
  });

  it('rejects null island', () => {
    expect(resolveCoords({ lng: 0, lat: 0, town: null, province: null })).toBeNull();
  });

  it('rejects coordinates outside South Africa', () => {
    // London — a plausible artefact of parsing a foreign dateline or wire copy.
    expect(resolveCoords({ lng: -0.12, lat: 51.5, town: null, province: null })).toBeNull();
  });

  it('accepts a genuine South African coordinate unchanged', () => {
    const r = resolveCoords({ lng: 28.05, lat: -26.2, town: null, province: null });
    expect(r).toEqual({ lng: 28.05, lat: -26.2 });
  });

  it('never returns a non-finite value for any input shape', () => {
    const inputs = [
      { lng: NaN, lat: NaN, town: 'Nowhere Fictional Place', province: null },
      { lng: undefined, lat: undefined, town: null, province: null },
      { lng: null, lat: null, town: null, province: 'Gauteng' },
      { lng: NaN, lat: -28, town: null, province: 'Free State' },
    ];
    for (const inc of inputs) {
      const r = resolveCoords(inc as Parameters<typeof resolveCoords>[0]);
      if (r !== null) {
        expect(Number.isFinite(r.lng)).toBe(true);
        expect(Number.isFinite(r.lat)).toBe(true);
      }
    }
  });
});
