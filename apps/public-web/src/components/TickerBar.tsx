import { useAppStore } from '@/stores/app-store';
import { sourceDomain } from '../data/mock-news';

/**
 * Full-width scrolling ticker pinned to the very top of the page.
 * Content and behaviour are driven entirely by the backend ticker config
 * (Admin → Ticker): on/off, custom words vs. an RSS source, scroll direction, speed.
 */
export function TickerBar() {
  const ticker = useAppStore((s) => s.ticker);
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

  // Duplicate the sequence so the CSS translateX(-50%) loop is seamless.
  const loop = [...items, ...items];

  const colorMap: Record<string, string> = { green: '#22c55e', yellow: '#eab308', red: '#ef4444', white: '' };
  const textColor = colorMap[ticker.fontColor] || '';

  return (
    <div className={`ticker-bar dir-${ticker.direction} tone-${ticker.tone}`} aria-label="News ticker" role="marquee">
      <span className="ticker-flag">
        <span className="ticker-flag-dot" />
        {ticker.tone === 'alert' ? 'ALERT' : ticker.mode === 'rss' ? 'LIVE' : 'NOTICE'}
      </span>
      <div className="ticker-viewport">
        <div
          className="ticker-track"
          style={{
            animationDuration: `${ticker.speedSeconds}s`,
            fontWeight: ticker.fontBold ? 700 : 400,
            fontSize: ticker.fontSize || 14,
            ...(textColor ? { color: textColor } : {}),
          }}
        >
          {loop.map((text, i) => (
            <span className="ticker-item" key={i} aria-hidden={i >= items.length}>
              <span className="ticker-sep" />
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
