import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { fetchIncidents, type IncidentRow } from '../api/incidents';
import { fetchActiveCampaigns, type CampaignRow } from '../api/sponsors';
import type { MockIncident } from '../../data/mock-incidents';
import { useAppStore } from '../../stores/app-store';
import { deduplicateByContent, incidentFingerprint } from '../utils/deduplicate';

interface IncidentDataContextValue {
  incidents: MockIncident[];
  campaigns: CampaignRow[];
  loading: boolean;
}

const IncidentDataContext = createContext<IncidentDataContextValue>({
  incidents: [],
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
    casualties: {
      deceased: r.fatality_count_confirmed ?? 0,
      injured: r.injury_count_confirmed ?? 0,
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

  const incidents = useMemo(
    () => deduplicateByContent(
      [...apiIncidents, ...importedIncidents],
      (i) => incidentFingerprint(i.title, i.dateOccurred ?? '', i.town ?? i.province ?? ''),
      (i) => i.id,
    ),
    [apiIncidents, importedIncidents],
  );

  const value = useMemo(
    () => ({ incidents, campaigns, loading }),
    [incidents, campaigns, loading],
  );

  useEffect(() => {
    console.log(`[IncidentDataProvider] incidents=${incidents.length} (api=${apiIncidents.length}, imported=${importedIncidents.length})`);
  }, [incidents.length, apiIncidents.length, importedIncidents.length]);

  return (
    <IncidentDataContext.Provider value={value}>
      {children}
    </IncidentDataContext.Provider>
  );
}

export function useIncidentData() {
  return useContext(IncidentDataContext);
}
