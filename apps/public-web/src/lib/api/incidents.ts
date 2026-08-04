import { supabase, isSupabaseConfigured } from '../supabase';
import { MOCK_INCIDENTS, type MockIncident } from '../../data/mock-incidents';
// Static, not dynamic: app-store imports only types, deduplicate and
// time-filter, none of which reach back here, so there is no cycle.
import { useAppStore } from '../../stores/app-store';

export interface IncidentRow {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  verification_state: string;
  severity: string;
  status: string;
  bam_classification: string;
  occurred_at: string | null;
  is_ongoing: boolean;
  confirmed_facts: string | null;
  reported_unconfirmed: string | null;
  what_remains_unknown: string | null;
  police_case_number: string | null;
  court_reference: string | null;
  victim_count_confirmed: number | null;
  fatality_count_confirmed: number | null;
  injury_count_confirmed: number | null;
  victim_count_reported: number | null;
  fatality_count_reported: number | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category?: { slug: string; label_en: string; module: string; icon_key: string; colour_key: string };
  location?: { province: string; town: string; lat: number; lng: number; location_tier: string; display_label: string };
  tags?: { tag: string }[];
  source_count?: number;
}

export async function fetchIncidents(filters?: {
  module?: string;
  severity?: string;
  search?: string;
  province?: string;
  isPublished?: boolean;
}): Promise<IncidentRow[]> {
  if (!isSupabaseConfigured()) return mockToRows();

  let query = supabase
    .from('incidents')
    .select(`
      *,
      category:incident_categories(slug, label_en, module, icon_key, colour_key),
      location:public_locations(province, town, point, location_tier, display_label),
      tags:incident_tags(tag),
      source_count:corroborations(count)
    `)
    .order('occurred_at', { ascending: false });

  if (filters?.isPublished !== undefined) {
    query = query.eq('is_published', filters.isPublished);
  }
  if (filters?.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters?.search) {
    query = query.textSearch('fts', filters.search);
  }
  if (filters?.province) {
    query = query.eq('location.province', filters.province);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let results = (data ?? []).map(normalizeIncident);

  if (filters?.module) {
    results = results.filter(r => r.category?.module === filters.module);
  }

  return results;
}

/**
 * Imported incidents live in the zustand store (backed by IndexedDB), not in
 * MOCK_INCIDENTS. Looking only at MOCK_INCIDENTS meant every popup link to an
 * IMPORTED record — i.e. every record in the user's own data — rendered
 * "Incident not found". Imported first, then mocks.
 *
 * `hydrate()` is awaited because this page (/incident/:id) can be loaded
 * directly, before anything else has pulled the store out of IndexedDB.
 */
async function findLocalIncident(id: string): Promise<MockIncident | undefined> {
  const state = useAppStore.getState();
  let imported = state.importedIncidents;
  if (imported.length === 0) {
    try {
      await state.hydrate();
      imported = useAppStore.getState().importedIncidents;
    } catch {
      /* IndexedDB unavailable — fall through to the mock lookup. */
    }
  }
  return imported.find(m => m.id === id) ?? MOCK_INCIDENTS.find(m => m.id === id);
}

export async function fetchIncidentById(id: string): Promise<IncidentRow | null> {
  if (!isSupabaseConfigured()) {
    const local = await findLocalIncident(id);
    return local ? mockToRow(local) : null;
  }

  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      category:incident_categories(slug, label_en, module, icon_key, colour_key),
      location:public_locations(province, town, point, location_tier, display_label),
      tags:incident_tags(tag),
      source_count:corroborations(count)
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data ? normalizeIncident(data) : null;
}

export async function createIncident(incident: Partial<IncidentRow>): Promise<IncidentRow> {
  if (!isSupabaseConfigured()) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('incidents')
    .insert(incident)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateIncident(id: string, updates: Partial<IncidentRow>): Promise<IncidentRow> {
  if (!isSupabaseConfigured()) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('incidents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function normalizeIncident(row: any): IncidentRow {
  const loc = Array.isArray(row.location) ? row.location[0] : row.location;
  let lat = 0, lng = 0;
  if (loc?.point) {
    const coords = typeof loc.point === 'string'
      ? JSON.parse(loc.point)?.coordinates
      : loc.point?.coordinates;
    if (coords) { lng = coords[0]; lat = coords[1]; }
  }

  return {
    ...row,
    location: loc ? { ...loc, lat, lng } : undefined,
    tags: row.tags ?? [],
    source_count: Array.isArray(row.source_count) ? row.source_count[0]?.count ?? 0 : 0,
  };
}

function mockToRows(): IncidentRow[] {
  return MOCK_INCIDENTS.map(mockToRow);
}

export function mockToRow(m: MockIncident): IncidentRow {
  return {
    id: m.id,
    title: m.title,
    slug: m.id,
    category_id: '',
    verification_state: m.verification,
    severity: m.severity,
    status: 'active',
    bam_classification: 'not_assessed',
    // '' means the source stated no date. It must stay absent, not render as
    // an empty cell that looks like a rendering fault.
    occurred_at: m.dateOccurred || null,
    is_ongoing: false,
    confirmed_facts: m.summary,
    reported_unconfirmed: null,
    what_remains_unknown: null,
    police_case_number: m.courtCase ?? null,
    court_reference: m.courtCase ?? null,
    victim_count_confirmed: m.casualties?.deceased ?? null,
    fatality_count_confirmed: m.casualties?.deceased ?? null,
    injury_count_confirmed: m.casualties?.injured ?? null,
    victim_count_reported: null,
    fatality_count_reported: null,
    is_published: true,
    published_at: m.dateReported || null,
    created_at: m.dateReported,
    updated_at: m.dateReported,
    category: { slug: m.category, label_en: m.category.replace(/_/g, ' '), module: m.module, icon_key: '', colour_key: '' },
    location: { province: m.province, town: m.town, lat: m.lat, lng: m.lng, location_tier: m.locationTier, display_label: `${m.town}, ${m.province}` },
    tags: m.tags.map(t => ({ tag: t })),
    source_count: m.sourceCount,
  };
}
