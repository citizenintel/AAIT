import { isSupabaseConfigured } from '../supabase';
import { MOCK_ASSETS } from '../../data/mock-assets';
import type { InfrastructureAsset } from '../../types/ontology';

export async function fetchAssets(): Promise<InfrastructureAsset[]> {
  if (!isSupabaseConfigured()) return MOCK_ASSETS;

  // TODO: wire to Supabase `infrastructure_assets` table once schema is deployed
  return MOCK_ASSETS;
}

export async function fetchAssetById(id: string): Promise<InfrastructureAsset | null> {
  if (!isSupabaseConfigured()) {
    return MOCK_ASSETS.find(a => a.id === id) ?? null;
  }

  // TODO: wire to Supabase
  return MOCK_ASSETS.find(a => a.id === id) ?? null;
}
