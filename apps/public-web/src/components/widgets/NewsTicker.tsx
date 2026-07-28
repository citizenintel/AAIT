import { useState, useMemo } from 'react';
import { MOCK_NEWS, sourceDomain } from '../../data/mock-news';
import { MODULE_META } from '../../data/mock-incidents';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { ManagedContentSlot, useResolvedContentSlot } from './ManagedContentSlot';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function LivePanel() {
  const { incidents } = useIncidentData();
  const stats = useMemo(() => {
    const critical = incidents.filter((i) => i.severity === 'critical').length;
    const sources = new Set(MOCK_NEWS.map((n) => n.source)).size;
    return { total: incidents.length, critical, sources, articles: MOCK_NEWS.length };
  }, [incidents]);

  return (
    <div className="bottom-panel-live">
      <div className="bottom-live-badge">
        <span className="widget-news-live">LIVE</span>
        <span className="bottom-live-label">Real-time feed</span>
      </div>
      <div className="bottom-live-stats">
        <div className="bottom-live-stat">
          <span className="bottom-live-stat-value">{stats.total}</span>
          <span className="bottom-live-stat-label">incidents 24h</span>
        </div>
        <div className="bottom-live-stat">
          <span className="bottom-live-stat-value" style={{ color: '#c53030' }}>{stats.critical}</span>
          <span className="bottom-live-stat-label">critical</span>
        </div>
        <div className="bottom-live-stat">
          <span className="bottom-live-stat-value">{stats.articles}</span>
          <span className="bottom-live-stat-label">articles</span>
        </div>
        <div className="bottom-live-stat">
          <span className="bottom-live-stat-value">{stats.sources}</span>
          <span className="bottom-live-stat-label">sources</span>
        </div>
      </div>
    </div>
  );
}

function RecentActivity() {
  const { incidents } = useIncidentData();
  const recent = useMemo(() => {
    return [...incidents]
      .sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime())
      .slice(0, 4);
  }, [incidents]);

  const sevColours: Record<string, string> = { critical: '#c53030', high: '#dd6b20', medium: '#d69e2e', low: '#3182ce' };

  return (
    <div className="bottom-panel-activity">
      <div className="bottom-activity-header">Recent Activity</div>
      <div className="bottom-activity-list">
        {recent.map((inc) => (
          <div key={inc.id} className="bottom-activity-item">
            <span className="bottom-activity-dot" style={{ background: sevColours[inc.severity] ?? '#718096' }} />
            <div className="bottom-activity-text">
              <span className="bottom-activity-title">{inc.title}</span>
              <span className="bottom-activity-meta">{inc.province} · {timeAgo(inc.dateReported)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewsTicker() {
  const [expanded, setExpanded] = useState(false);
  const bottomSlot = useResolvedContentSlot('BOTTOM_INTELLIGENCE_LEADERBOARD');
  const bottomVisible = bottomSlot.type !== 'hidden';

  const news = MOCK_NEWS.slice(0, expanded ? 12 : 4);

  return (
    <div className={`bottom-zone-grid${expanded ? ' expanded' : ''}`}>
      <div className="bottom-infographics-panel">
        <LivePanel />
      </div>
      {bottomVisible && (
        <div className="bottom-ad-panel">
          <ManagedContentSlot slotKey="BOTTOM_INTELLIGENCE_LEADERBOARD" resolved={bottomSlot} />
        </div>
      )}

      <div className="bottom-panel-news">
        <div className="widget-news-header">
          <span className="widget-news-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
            </svg>
            News Feed
          </span>
          <button className={`widget-news-toggle ${expanded ? 'collapse' : 'expand'}`} onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        <div className="widget-news-list">
          {news.map(item => {
            const modMeta = item.module !== 'general' ? MODULE_META[item.module] : null;
            return (
              <div key={item.id} className="widget-news-item">
                <div className="widget-news-item-header">
                  {modMeta && <span className="widget-news-module" style={{ color: modMeta.colour }}>{modMeta.label}</span>}
                  <span className="widget-news-source">{item.source}</span>
                  <span className="widget-news-time">{timeAgo(item.publishedAt)}</span>
                </div>
                <div className="widget-news-item-title">{item.title}</div>
                <div className="widget-news-source-addr" title="Source — read on-site, not an external link">{sourceDomain(item.source)}</div>
              </div>
            );
          })}
        </div>
        <div className="widget-news-footer">
          Synthetic feed — {MOCK_NEWS.length} articles from {new Set(MOCK_NEWS.map(n => n.source)).size} sources
        </div>
      </div>

      <RecentActivity />
    </div>
  );
}
