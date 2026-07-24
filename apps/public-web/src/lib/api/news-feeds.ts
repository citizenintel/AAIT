import { supabase, isSupabaseConfigured } from '../supabase';
import { MOCK_NEWS, MOCK_RSS_FEEDS } from '../../data/mock-news';
import type { NewsItem, RssFeedConfig } from '../../data/mock-news';

export async function fetchNewsItems(limit = 50): Promise<NewsItem[]> {
  if (!isSupabaseConfigured()) return MOCK_NEWS;

  const { data, error } = await supabase
    .from('news_items')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) return MOCK_NEWS;
  return data ?? MOCK_NEWS;
}

export async function fetchRssFeeds(): Promise<RssFeedConfig[]> {
  if (!isSupabaseConfigured()) return MOCK_RSS_FEEDS;

  const { data, error } = await supabase
    .from('rss_feeds')
    .select('*')
    .order('name', { ascending: true });

  if (error) return MOCK_RSS_FEEDS;
  return data ?? MOCK_RSS_FEEDS;
}

export async function updateRssFeed(id: string, updates: Partial<RssFeedConfig>): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('rss_feeds')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function createRssFeed(feed: Omit<RssFeedConfig, 'id' | 'lastFetched' | 'articleCount'>): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('rss_feeds')
    .insert(feed)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteRssFeed(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('rss_feeds')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
