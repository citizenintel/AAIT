import { supabase, isSupabaseConfigured } from '../supabase';
import { MOCK_NEWS, MOCK_RSS_FEEDS } from '../../data/mock-news';
import type { NewsItem, RssFeedConfig } from '../../data/mock-news';

let mockFeeds: RssFeedConfig[] = MOCK_RSS_FEEDS.map(f => ({ ...f }));

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
  if (!isSupabaseConfigured()) return mockFeeds.map(f => ({ ...f }));

  const { data, error } = await supabase
    .from('rss_feeds')
    .select('*')
    .order('name', { ascending: true });

  if (error) return mockFeeds;
  return data ?? mockFeeds;
}

export async function updateRssFeed(id: string, updates: Partial<RssFeedConfig>): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockFeeds.findIndex(f => f.id === id);
    if (idx !== -1) Object.assign(mockFeeds[idx]!, updates);
    return;
  }

  const { error } = await supabase
    .from('rss_feeds')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function createRssFeed(feed: Omit<RssFeedConfig, 'id' | 'lastFetched' | 'articleCount'>): Promise<string> {
  const id = `rss-${Date.now().toString(36)}`;
  if (!isSupabaseConfigured()) {
    mockFeeds.push({ ...feed, id, lastFetched: null, articleCount: 0 });
    return id;
  }

  const { data, error } = await supabase
    .from('rss_feeds')
    .insert(feed)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteRssFeed(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    mockFeeds = mockFeeds.filter(f => f.id !== id);
    return;
  }

  const { error } = await supabase
    .from('rss_feeds')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
