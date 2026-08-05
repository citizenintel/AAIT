import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { fetchIncidents, type IncidentRow } from '../api/incidents';
import { fetchActiveCampaigns, type CampaignRow } from '../api/sponsors';
import type { MockIncident } from '../../data/mock-incidents';
import { useAppStore } from '../../stores/app-store';
import { deduplicateWithStats, mockIncidentFingerprint } from '../utils/deduplicate';
import {
  applyTimeFilter, computeExtent, describeFilter, isBounded, resolveBounds,
  type DataExtent, type DateBounds, type TimeFilter,
} from '../utils/time-filter';

export interface IncidentDataContextValue {
  /**
   * The published dataset — every surface that COUNTS, MAPS or CHARTS incidents
   * reads this, so the map and the dashboard tiles can never disagree.
   *
   * Two gates have been applied:
   *  1. Records still awaiting human review are NOT here: they are
   *     machine-derived and the app promises on the import page that "an editor
   *     must approve each record before it appears on the map".
   *  2. The active time window (see `timeFilter`). Records with NO usable date
   *     are included unless the user explicitly excluded them — see
   *     `undatedIncluded`. There is no path in which a record disappears from
   *     here without being counted in one of the numbers below.
   */
  incidents: MockIncident[];
  /**
   * Review-passed, NOT time-filtered. For lookups by id, chart domains, and the
   * "N total" denominator. A lookup scoped by the active window returns
   * undefined for a record the user can still see on screen.
   */
  allIncidents: MockIncident[];
  /** How many stored records are being withheld pending review. */
  awaitingReview: number;
  /**
   * Records removed before publication because another record carried the same
   * content + date + place. This is the ONE remaining path by which a stored
   * record does not reach `allIncidents`, so it is counted here and rendered in
   * the shell banner and the map. Without it every number below silently
   * under-reports: they are all computed on the post-dedup set.
   */
  mergedCount: number;
  /**
   * Everything the app is holding, before any gate:
   * storedCount === totalCount + mergedCount + awaitingReview.
   * That identity is the whole point — it makes "where did my records go?"
   * answerable from the UI alone.
   */
  storedCount: number;

  /**
   * Imported records that PASSED the review gate. Zero means nothing the user
   * imported has reached the map yet, even though `allIncidents` may be full of
   * built-in demo records. Callers must test this rather than
   * `allIncidents.length === 0` — with Supabase unconfigured, fetchIncidents()
   * falls back to 23 bundled mock rows, so `allIncidents` is never empty and any
   * check against it silently never fires.
   */
  publishedImportedCount: number;

  // --- Counts. total === inRange + outOfRange + (undated if excluded) ---
  /** allIncidents.length — everything that passed review AND dedup. */
  totalCount: number;
  /** incidents.length — what is published under the active window. */
  inRangeCount: number;
  /** Dated, but falling outside the active window. */
  outOfRangeCount: number;
  /** No usable date at all, across the WHOLE reviewed dataset. */
  undatedCount: number;
  /** Whether those undated records are currently inside `incidents`. */
  undatedIncluded: boolean;
  /** Alias of outOfRangeCount, for call sites that read more naturally that way. */
  outsideWindowCount: number;

  /** Min/max/year list across allIncidents. null when nothing is dated. */
  dataExtent: DataExtent | null;
  /** The active filter as chosen by the user. */
  timeFilter: TimeFilter;
  /** The filter resolved to inclusive 'YYYY-MM-DD' bounds. */
  bounds: DateBounds;
  /** True when the window actually restricts anything. */
  filterActive: boolean;
  /** Human label for the window, e.g. 'All time', '2000', 'Last 30 days'. */
  filterLabel: string;

  campaigns: CampaignRow[];
  loading: boolean;
}

const IncidentDataContext = createContext<IncidentDataContextValue>({
  incidents: [],
  allIncidents: [],
  awaitingReview: 0,
  mergedCount: 0,
  storedCount: 0,
  publishedImportedCount: 0,
  totalCount: 0,
  inRangeCount: 0,
  outOfRangeCount: 0,
  undatedCount: 0,
  undatedIncluded: true,
  outsideWindowCount: 0,
  dataExtent: null,
  timeFilter: { mode: 'all' },
  bounds: { from: null, to: null },
  filterActive: false,
  filterLabel: 'All time',
  campaigns: [],
  loading: true,
});

function rowToMock(r: IncidentRow): MockIncident {
  return {
    id: r.id,
    title: r.title,
    summary: r.confirmed_facts ?? '',
    module: (r.category?.module ?? 'ait') as MockIncident['module'],
    category: r.category?.slug ?? '',
    severity: r.severity as MockIncident['severity'],
    verification: r.verification_state as MockIncident['verification'],
    locationTier: (r.location?.location_tier ?? 'approximate_cell') as MockIncident['locationTier'],
    lng: r.location?.lng ?? 0,
    lat: r.location?.lat ?? 0,
    province: r.location?.province ?? '',
    town: r.location?.town ?? '',
    // NO created_at fallback. A row with no stated occurrence date has no
    // occurrence date; created_at is when the DATABASE saw it, which is not
    // evidence about when anything happened. Stamping it here made a 1990s
    // attack load as a 2026 incident — the exact fabrication that was
    // deliberately removed from the importer. '' routes to the undated bucket,
    // where it is counted and disclosed rather than silently misdated.
    dateOccurred: r.occurred_at ?? '',
    dateReported: r.published_at ?? '',
    sourceCount: typeof r.source_count === 'number' ? r.source_count : 0,
    sources: [],
    tags: (r.tags ?? []).map(t => t.tag),
    isSynthetic: true,
    // `?? 0` here turned "the API returned no figure" into "zero confirmed
    // deaths", which is then summed into published totals. A null figure stays
    // absent.
    casualties: (r.fatality_count_confirmed == null && r.injury_count_confirmed == null)
      ? undefined
      : {
          ...(r.fatality_count_confirmed != null ? { deceased: r.fatality_count_confirmed } : {}),
          ...(r.injury_count_confirmed != null ? { injured: r.injury_count_confirmed } : {}),
        },
  };
}

export function IncidentDataProvider({ children }: { children: ReactNode }) {
  const [apiIncidents, setApiIncidents] = useState<MockIncident[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const importedIncidents = useAppStore((s) => s.importedIncidents);
  const hydrate = useAppStore((s) => s.hydrate);
  // The window lives in the app store so the filter and the dataset re-derive in
  // one render pass and all consumers of this provider inherit it with no
  // prop-drilling. Default is All time — see app-store.ts.
  const timeFilter = useAppStore((s) => s.timeFilter);
  const includeUndated = useAppStore((s) => s.includeUndated);
  const refreshCounter = useAppStore((s) => s.refreshCounter);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchIncidents(), fetchActiveCampaigns()])
      .then(([rows, camps]) => {
        if (cancelled) return;
        setApiIncidents(rows.map(rowToMock));
        setCampaigns(camps);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshCounter]);

  /**
   * BLOCKER FIX. `importedIncidents` used to be merged straight into the
   * dataset the public map and every dashboard consume, with no needsReview
   * filter — so a record whose category, severity, position and date were all
   * machine-guesses was published beside a source-verified one and counted in
   * the same totals. Every flag the importer and splitter set was written to
   * storage and read by nobody.
   *
   * Records awaiting review are withheld here and surfaced in the admin import
   * page, where an editor can inspect their derived fields and release them.
   */
  const reviewed = useMemo(
    () => importedIncidents.filter(i => !i.needsReview),
    [importedIncidents],
  );
  const awaitingReview = importedIncidents.length - reviewed.length;

  /**
   * Dedup FIRST, then time-filter. Filtering first would let the surviving
   * member of a duplicate pair depend on the active window.
   *
   * BLOCKER FIX. This used to call `deduplicateByContent`, which returns only
   * the survivors. Every count the UI shows is derived from the result, so a
   * merge reduced "N records in total", "N published" and the window's "−N"
   * with nothing anywhere reporting that it had happened — the single remaining
   * silent-drop path in the pipeline, and the one most likely to fire on a real
   * historical import (repeated short narratives, many undated rows).
   * `deduplicateWithStats` reports the removals; they are published on the
   * context as `mergedCount` and rendered.
   */
  const deduped = useMemo(
    () => deduplicateWithStats(
      [...apiIncidents, ...reviewed],
      // The canonical key — shared with the store's ingress check and its
      // dedup command, so the three layers can no longer disagree about what a
      // duplicate is. See mockIncidentFingerprint.
      mockIncidentFingerprint,
      (i) => i.id,
    ),
    [apiIncidents, reviewed],
  );
  const allIncidents = deduped.items;
  const mergedCount = deduped.removedCount;
  const storedCount = apiIncidents.length + importedIncidents.length;

  const bounds = useMemo(() => resolveBounds(timeFilter), [timeFilter]);

  /**
   * The time gate. `applyTimeFilter` never parses a source string with `new
   * Date()`, so it cannot produce NaN and cannot drop a record through a failed
   * comparison. Undated records are counted and routed explicitly.
   */
  const filtered = useMemo(
    () => applyTimeFilter(allIncidents, (i) => i.dateOccurred, bounds, includeUndated),
    [allIncidents, bounds, includeUndated],
  );

  const dataExtent = useMemo(
    () => computeExtent(allIncidents, (i) => i.dateOccurred),
    [allIncidents],
  );

  const filterActive = isBounded(bounds);
  const filterLabel = useMemo(() => describeFilter(timeFilter), [timeFilter]);

  const value = useMemo<IncidentDataContextValue>(
    () => ({
      incidents: filtered.matched,
      allIncidents,
      awaitingReview,
      mergedCount,
      storedCount,
      publishedImportedCount: reviewed.length,
      totalCount: filtered.totalCount,
      inRangeCount: filtered.inRangeCount,
      outOfRangeCount: filtered.outOfRangeCount,
      undatedCount: filtered.undatedCount,
      undatedIncluded: filtered.undatedIncluded,
      outsideWindowCount: filtered.outOfRangeCount,
      dataExtent,
      timeFilter,
      bounds,
      filterActive,
      filterLabel,
      campaigns,
      loading,
    }),
    [filtered, allIncidents, awaitingReview, mergedCount, storedCount, reviewed.length,
     dataExtent, timeFilter, bounds, filterActive, filterLabel, campaigns, loading],
  );

  useEffect(() => {
    console.log(
      `[IncidentDataProvider] published=${filtered.inRangeCount} of ${filtered.totalCount} ` +
      `(api=${apiIncidents.length}, imported=${importedIncidents.length}, ` +
      `stored=${storedCount}, withheld pending review=${awaitingReview}, ` +
      `merged as duplicates=${mergedCount}, window="${filterLabel}", ` +
      `outside window=${filtered.outOfRangeCount}, undated=${filtered.undatedCount}` +
      `${filtered.undatedIncluded ? ' (included)' : ' (excluded by you)'})`,
    );
    // The identity that makes every record accounted for. If this ever trips,
    // a new silent-drop path has been introduced upstream of the counts.
    if (storedCount !== filtered.totalCount + mergedCount + awaitingReview) {
      console.error(
        '[IncidentDataProvider] RECORD ACCOUNTING MISMATCH — records are ' +
        `unaccounted for: stored=${storedCount}, published-eligible=${filtered.totalCount}, ` +
        `merged=${mergedCount}, awaiting review=${awaitingReview}.`,
      );
    }
  }, [filtered, apiIncidents.length, importedIncidents.length, awaitingReview,
      mergedCount, storedCount, filterLabel]);

  return (
    <IncidentDataContext.Provider value={value}>
      {children}
    </IncidentDataContext.Provider>
  );
}

export function useIncidentData() {
  return useContext(IncidentDataContext);
}
