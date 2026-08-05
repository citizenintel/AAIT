import { useAppStore } from '@/stores/app-store';
import { sourceDomain } from '../data/mock-news';

const FONT_SIZES: Record<string, number> = { small: 10, medium: 12, large: 15 };
const FONT_COLORS: Record<string, string> = { white: '#e2e8f0', yellow: '#eab308', red: '#ef4444' };

export function PriorityTicker() {
  const pt = useAppStore((s) => s.priorityTicker);
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);
  const newsItems = useAppStore((s) => s.newsItems);

  if (sponsorsEnabled || !pt.enabled) return null;

  const fontSize = FONT_SIZES[pt.fontSize] || 12;
  const color = FONT_COLORS[pt.fontColor] || '#e2e8f0';

  if (pt.mode === 'manual' && pt.manualText.trim()) {
    return (
      <section className="glance-priority-ticker">
        <span className="ticker-flag" style={{ color: '#c9a84c' }}>
          <span className="ticker-flag-dot" />
          PRIORITY
        </span>
        <div className="p-ticker-manual" style={{ fontSize, color, fontWeight: 600 }}>
          {pt.manualText}
        </div>
      </section>
    );
  }

  const items = newsItems.map((n) => `${n.title}  ·  ${sourceDomain(n.source)}`);
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <section className="glance-priority-ticker">
      <span className="ticker-flag" style={{ color: '#c9a84c' }}>
        <span className="ticker-flag-dot" />
        PRIORITY
      </span>
      <div className="p-ticker-viewport">
        <div
          className="p-ticker-track"
          style={{ animationDuration: '120s', fontSize, color, fontWeight: 500 }}
        >
          {loop.map((text, i) => (
            <span className="p-ticker-item" key={i} aria-hidden={i >= items.length}>
              <span className="p-ticker-sep" />
              {text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
