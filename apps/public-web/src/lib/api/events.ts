import { isSupabaseConfigured } from '../supabase';
import { MOCK_EVENTS } from '../../data/mock-events';
import type { IntelligenceEvent } from '../../types/ontology';

export async function fetchEvents(): Promise<IntelligenceEvent[]> {
  if (!isSupabaseConfigured()) return MOCK_EVENTS;

  // TODO: wire to Supabase `intelligence_events` table once schema is deployed
  return MOCK_EVENTS;
}

export async function fetchEventById(id: string): Promise<IntelligenceEvent | null> {
  if (!isSupabaseConfigured()) {
    return MOCK_EVENTS.find(e => e.id === id) ?? null;
  }

  // TODO: wire to Supabase
  return MOCK_EVENTS.find(e => e.id === id) ?? null;
}
