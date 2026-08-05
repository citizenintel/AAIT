import { useAppStore } from '@/stores/app-store';
import { sourceDomain } from '../data/mock-news';

export function BottomTicker() {
  const ticker = useAppStore((s) => s.bottomTicker);
  const newsItems = useAppStore((s) => s.newsItems);
  const rssFeeds = useAppStore((s) => s.rssFeeds);

  if (!ticker.enabled) return null;

  let items: string[];
  if (ticker.mode === 'custom') {
    items = ticker.customText.split('\n').map((s) => s.trim()).filter(Boolean);
  } else {
    const feed = ticker.rssFeedId ? rssFeeds.find((f) => f.id === ticker.rssFeedId) : null;
    const pool = feed
      ? newsItems.filter((n) => n.source === feed.name || feed.name.includes(n.source))
      : newsItems;
    const source = pool.length > 0 ? pool : newsItems;
    items = source.map((n) => `${n.title}  ·  ${sourceDomain(n.source)}`);
  }

  if (items.length === 0) items = ['AAIT Incident Tracker'];

  const loop = [...items, ...items];

  const colorMap: Record<string, string> = { green: '#22c55e', yellow: '#eab308', red: '#ef4444', white: '#e2e8f0' };
  const textColor = colorMap[ticker.fontColor] || '#e2e8f0';
  const fontSize = ticker.fontSize || 14;

  return (
    <div className="bottom-ticker" aria-label="Live ticker" role="marquee">
      <div className="bottom-ticker-viewport">
        <div
          className="bottom-ticker-track"
          style={{
            animationDuration: `${ticker.speedSeconds}s`,
            fontWeight: 700,
            fontSize,
            color: textColor,
          }}
        >
          {loop.map((text, i) => (
            <span className="bottom-ticker-item" key={i} aria-hidden={i >= items.length}>
              <span className="bottom-ticker-sep" />
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
