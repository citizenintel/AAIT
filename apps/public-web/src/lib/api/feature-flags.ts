import { supabase, isSupabaseConfigured } from '../supabase';

export interface FeatureFlagRow {
  id: string;
  key: string;
  label: string;
  category: string;
  is_enabled: boolean;
  provider: string | null;
  status: string;
}

const SEED_FLAGS: FeatureFlagRow[] = [
  { id: '1', key: 'map_provider', label: 'MapLibre GL JS', category: 'map', is_enabled: true, provider: 'maplibre', status: 'active' },
  { id: '2', key: 'satellite', label: 'Satellite imagery', category: 'map', is_enabled: true, provider: null, status: 'active' },
  { id: '3', key: '3d_terrain', label: '3D terrain rendering', category: 'map', is_enabled: false, provider: null, status: 'inactive' },
  { id: '4', key: 'geocoding', label: 'Geocoding / lat-lng lookup', category: 'map', is_enabled: false, provider: null, status: 'inactive' },
  { id: '5', key: 'email_notifications', label: 'Email notifications', category: 'notifications', is_enabled: false, provider: 'disabled', status: 'inactive' },
  { id: '6', key: 'push_notifications', label: 'Push notifications', category: 'notifications', is_enabled: false, provider: null, status: 'inactive' },
  { id: '7', key: 'malware_scanning', label: 'Malware scanning', category: 'security', is_enabled: false, provider: null, status: 'inactive' },
  { id: '8', key: 'ai_assistance', label: 'AI assistance', category: 'ai', is_enabled: false, provider: 'disabled', status: 'inactive' },
  { id: '9', key: 'translation', label: 'EN ↔ AF translation', category: 'ai', is_enabled: false, provider: null, status: 'inactive' },
  { id: '10', key: 'sponsorship', label: 'Sponsorship system', category: 'revenue', is_enabled: true, provider: null, status: 'active' },
  { id: '11', key: 'news_ingestion', label: 'News ingestion', category: 'ingestion', is_enabled: false, provider: null, status: 'inactive' },
  { id: '12', key: 'bulk_import', label: 'Bulk CSV import', category: 'ingestion', is_enabled: false, provider: null, status: 'inactive' },
  { id: '13', key: 'data_export', label: 'Data export', category: 'data', is_enabled: true, provider: null, status: 'active' },
  { id: '14', key: 'analytics', label: 'Analytics engine', category: 'data', is_enabled: true, provider: null, status: 'active' },
];

let mockFlags: FeatureFlagRow[] = SEED_FLAGS.map(f => ({ ...f }));

export async function fetchFeatureFlags(): Promise<FeatureFlagRow[]> {
  if (!isSupabaseConfigured()) return mockFlags.map(f => ({ ...f }));

  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('category', { ascending: true });

  if (error) return mockFlags;

  return (data ?? []).map(f => ({
    id: f.id,
    key: f.key ?? f.name,
    label: f.label ?? f.name,
    category: f.category ?? 'general',
    is_enabled: f.is_enabled ?? false,
    provider: f.provider ?? null,
    status: f.status ?? 'inactive',
  }));
}

export async function toggleFeatureFlag(id: string, enabled: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockFlags.findIndex(f => f.id === id);
    if (idx !== -1) Object.assign(mockFlags[idx]!, { is_enabled: enabled, status: enabled ? 'active' : 'inactive' });
    return;
  }

  const { error } = await supabase
    .from('feature_flags')
    .update({ is_enabled: enabled, status: enabled ? 'active' : 'inactive' })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export function isFeatureEnabled(flags: FeatureFlagRow[], key: string): boolean {
  return flags.find(f => f.key === key)?.is_enabled ?? false;
}
