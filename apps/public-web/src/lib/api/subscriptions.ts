import { supabase, isSupabaseConfigured } from '../supabase';
import { MOCK_TIERS, MOCK_SUBSCRIBERS } from '../../data/mock-subscriptions';
import type { SubscriptionTier, Subscriber } from '../../data/mock-subscriptions';

export async function fetchTiers(): Promise<SubscriptionTier[]> {
  if (!isSupabaseConfigured()) return MOCK_TIERS;

  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .order('price', { ascending: true });

  if (error) return MOCK_TIERS;
  return data ?? MOCK_TIERS;
}

export async function fetchSubscribers(): Promise<Subscriber[]> {
  if (!isSupabaseConfigured()) return MOCK_SUBSCRIBERS;

  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) return MOCK_SUBSCRIBERS;
  return data ?? MOCK_SUBSCRIBERS;
}

export async function updateTier(id: string, updates: Partial<SubscriptionTier>): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('subscription_tiers')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function cancelSubscription(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('subscribers')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) throw new Error(error.message);
}
