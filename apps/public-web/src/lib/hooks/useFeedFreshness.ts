import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { MOCK_RSS_FEEDS } from '@/data/mock-news';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const OVERWRITE_AGE_MS = 30 * 60 * 1000;    // 30 minutes — new updates replace older content
const STALE_REMOVE_MS = 4 * 60 * 60 * 1000; // 4 hours — remove if no new updates

export function useFeedFreshness() {
  const feedLastRefresh = useAppStore((s) => s.feedLastRefresh);
  const markFeedRefreshed = useAppStore((s) => s.markFeedRefreshed);
  const cleanStaleFeeds = useAppStore((s) => s.cleanStaleFeeds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshFeeds = useCallback(() => {
    const now = Date.now();
    const enabledFeeds = MOCK_RSS_FEEDS.filter(f => f.enabled);

    for (const feed of enabledFeeds) {
      const lastTs = feedLastRefresh[feed.id] ?? 0;
      const age = now - lastTs;

      if (lastTs === 0 || age >= OVERWRITE_AGE_MS) {
        markFeedRefreshed(feed.id);
      }
    }

    cleanStaleFeeds();
  }, [feedLastRefresh, markFeedRefreshed, cleanStaleFeeds]);

  useEffect(() => {
    refreshFeeds();

    intervalRef.current = setInterval(refreshFeeds, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshFeeds]);

  const getFeedAge = useCallback((feedId: string): { ageMs: number; isStale: boolean; isFresh: boolean; label: string } => {
    const ts = feedLastRefresh[feedId];
    if (!ts) return { ageMs: Infinity, isStale: true, isFresh: false, label: 'never' };

    const ageMs = Date.now() - ts;
    const isStale = ageMs > STALE_REMOVE_MS;
    const isFresh = ageMs < OVERWRITE_AGE_MS;

    let label: string;
    if (ageMs < 60_000) label = 'just now';
    else if (ageMs < 5 * 60_000) label = `${Math.floor(ageMs / 60_000)}m ago`;
    else if (ageMs < 60 * 60_000) label = `${Math.floor(ageMs / 60_000)}m ago`;
    else label = `${Math.floor(ageMs / 3_600_000)}h ago`;

    return { ageMs, isStale, isFresh, label };
  }, [feedLastRefresh]);

  const activeFeedCount = Object.keys(feedLastRefresh).length;
  const nextRefreshIn = REFRESH_INTERVAL_MS;

  return { refreshFeeds, getFeedAge, activeFeedCount, nextRefreshIn };
}
