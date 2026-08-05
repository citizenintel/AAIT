import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { fetchNewsItems, fetchRssFeeds } from '@/lib/api/news-feeds';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useAutoRefresh() {
  const setNewsItems = useAppStore((s) => s.setNewsItems);
  const setRssFeeds = useAppStore((s) => s.setRssFeeds);
  const setLastRefreshAt = useAppStore((s) => s.setLastRefreshAt);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function refresh() {
      console.log('[AutoRefresh] Refreshing news, feeds, and incidents...');
      try {
        const [news, feeds] = await Promise.all([
          fetchNewsItems(),
          fetchRssFeeds(),
        ]);
        setNewsItems(news);
        setRssFeeds(feeds);
        setLastRefreshAt(Date.now());
        triggerRefresh();
        console.log(`[AutoRefresh] Done — ${news.length} news items, ${feeds.length} feeds`);
      } catch (err) {
        console.warn('[AutoRefresh] Failed:', err);
      }
    }

    refresh();

    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setNewsItems, setRssFeeds, setLastRefreshAt, triggerRefresh]);
}
