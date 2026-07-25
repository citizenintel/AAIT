import { supabase, isSupabaseConfigured } from '../supabase';
import { MOCK_TIERS, MOCK_SUBSCRIBERS } from '../../data/mock-subscriptions';
import type { SubscriptionTier, Subscriber } from '../../data/mock-subscriptions';

let mockTiers: SubscriptionTier[] = MOCK_TIERS.map(t => ({ ...t, benefits: [...t.benefits] }));
let mockSubscribers: Subscriber[] = MOCK_SUBSCRIBERS.map(s => ({ ...s }));

export async function fetchTiers(): Promise<SubscriptionTier[]> {
  if (!isSupabaseConfigured()) return mockTiers.map(t => ({ ...t, benefits: [...t.benefits] }));

  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .order('price', { ascending: true });

  if (error) return mockTiers;
  return data ?? mockTiers;
}

export async function fetchSubscribers(): Promise<Subscriber[]> {
  if (!isSupabaseConfigured()) return mockSubscribers.map(s => ({ ...s }));

  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) return mockSubscribers;
  return data ?? mockSubscribers;
}

export async function updateTier(id: string, updates: Partial<SubscriptionTier>): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockTiers.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(mockTiers[idx]!, updates);
    return;
  }

  const { error } = await supabase
    .from('subscription_tiers')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function cancelSubscription(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockSubscribers.findIndex(s => s.id === id);
    if (idx !== -1) Object.assign(mockSubscribers[idx]!, { status: 'cancelled' as const });
    return;
  }

  const { error } = await supabase
    .from('subscribers')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) throw new Error(error.message);
}
