import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { fetchIncidents, type IncidentRow } from '../api/incidents';
import { fetchActiveCampaigns, type CampaignRow } from '../api/sponsors';
import type { MockIncident } from '../../data/mock-incidents';
import { useAppStore } from '../../stores/app-store';
import { deduplicateByContent, incidentFingerprint } from '../utils/deduplicate';

interface IncidentDataContextValue {
  /**
   * The published dataset — every surface that counts, maps or lists incidents
   * reads this. Records still awaiting human review are NOT here: they are
   * machine-derived and the app promises on the import page that "an editor must
   * approve each record before it appears on the map".
   */
  incidents: MockIncident[];
  /** How many stored records are being withheld pending review. */
  awaitingReview: number;
  campaigns: CampaignRow[];
  loading: boolean;
}

const IncidentDataContext = createContext<IncidentDataContextValue>({
  incidents: [],
  awaitingReview: 0,
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
    dateOccurred: r.occurred_at ?? r.created_at,
    dateReported: r.published_at ?? r.created_at,
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
  }, []);

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

  const incidents = useMemo(
    () => deduplicateByContent(
      [...apiIncidents, ...reviewed],
      // Keyed on the SUMMARY, not the title. A title is a short, often
      // generated string: two genuinely distinct incidents in the same town on
      // the same day produced an identical fingerprint and one of them was
      // silently dropped. The summary is the record's actual content.
      (i) => incidentFingerprint(
        i.summary || i.title,
        i.dateOccurred ?? '',
        i.town ?? i.province ?? '',
      ),
      (i) => i.id,
    ),
    [apiIncidents, reviewed],
  );

  const value = useMemo(
    () => ({ incidents, awaitingReview, campaigns, loading }),
    [incidents, awaitingReview, campaigns, loading],
  );

  useEffect(() => {
    console.log(
      `[IncidentDataProvider] published=${incidents.length} ` +
      `(api=${apiIncidents.length}, imported=${importedIncidents.length}, withheld pending review=${awaitingReview})`,
    );
  }, [incidents.length, apiIncidents.length, importedIncidents.length, awaitingReview]);

  return (
    <IncidentDataContext.Provider value={value}>
      {children}
    </IncidentDataContext.Provider>
  );
}

export function useIncidentData() {
  return useContext(IncidentDataContext);
}
