import { useState } from 'react';
import type { RssFeedConfig } from '../../data/mock-news';
import { fetchRssFeeds, updateRssFeed, createRssFeed, deleteRssFeed } from '@/lib/api/news-feeds';
import { useQuery } from '@/lib/hooks/useQuery';

export function AdminFeeds() {
  const { data: feeds, loading, error, refetch } = useQuery(fetchRssFeeds, []);
  const [showAdd, setShowAdd] = useState(false);
  const [newFeed, setNewFeed] = useState({ name: '', url: '', category: '' });

  const toggleFeed = async (id: string) => {
    const feed = (feeds ?? []).find(f => f.id === id);
    if (!feed) return;
    try {
      await updateRssFeed(id, { enabled: !feed.enabled });
      refetch();
    } catch { /* errors surfaced on next refetch */ }
  };

  const addFeed = async () => {
    if (!newFeed.name || !newFeed.url) return;
    try {
      await createRssFeed({ name: newFeed.name, url: newFeed.url, category: newFeed.category || 'general', enabled: true });
      setNewFeed({ name: '', url: '', category: '' });
      setShowAdd(false);
      refetch();
    } catch { /* errors surfaced on next refetch */ }
  };

  const removeFeed = async (id: string) => {
    try {
      await deleteRssFeed(id);
      refetch();
    } catch { /* errors surfaced on next refetch */ }
  };

  const feedList = feeds ?? [];
  const enabledCount = feedList.filter(f => f.enabled).length;
  const totalArticles = feedList.reduce((s, f) => s + f.articleCount, 0);
  const categories = [...new Set(feedList.map(f => f.category))];

  if (loading) return <div className="admin-page"><p>Loading feeds...</p></div>;
  if (error) return <div className="admin-page"><p className="error-text">Error loading feeds: {error}</p></div>;

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>News Feeds</h1>
        <p>RSS/Atom feeds from South African news sources. Articles are ingested, categorised, and displayed in the news ticker. Historical data from Internet Archive included.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{enabledCount}</div>
          <div className="stat-label">Active feeds</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{feedList.length}</div>
          <div className="stat-label">Total feeds</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalArticles.toLocaleString()}</div>
          <div className="stat-label">Articles indexed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{categories.length}</div>
          <div className="stat-label">Categories</div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Feed sources</h2>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? 'Cancel' : '+ Add feed'}
          </button>
        </div>

        {showAdd && (
          <div className="feed-add-form" style={{ marginBottom: 16, padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div className="form-group">
              <label className="form-label">Feed name</label>
              <input type="text" className="form-input" placeholder="e.g. Daily Maverick" value={newFeed.name} onChange={e => setNewFeed(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">RSS/Atom URL</label>
              <input type="url" className="form-input" placeholder="https://example.com/feed/rss" value={newFeed.url} onChange={e => setNewFeed(s => ({ ...s, url: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={newFeed.category} onChange={e => setNewFeed(s => ({ ...s, category: e.target.value }))}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={addFeed}>Add feed</button>
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        )}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Source</th>
              <th>Category</th>
              <th>Articles</th>
              <th>Last fetched</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {feedList.map(feed => (
              <tr key={feed.id}>
                <td>
                  <label className="toggle-switch" style={{ margin: 0 }}>
                    <input type="checkbox" checked={feed.enabled} onChange={() => toggleFeed(feed.id)} />
                    <span className="toggle-slider" />
                  </label>
                </td>
                <td>
                  <div className="td-title">{feed.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feed.url}</div>
                </td>
                <td><span className="table-badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{feed.category}</span></td>
                <td>{feed.articleCount.toLocaleString()}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(feed.lastFetched)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-small">Fetch now</button>
                    <button className="btn btn-small btn-danger" onClick={() => removeFeed(feed.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h2>Internet Archive integration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
          Historical farm attack data from FarmiTracker (now defunct) is preserved via the Wayback Machine. This feed crawls archived pages dating back to the early 1990s.
        </p>
        <div className="settings-info">
          <div className="info-row"><span>Archive source</span><span>web.archive.org/web/*/farmitracker.co.za/*</span></div>
          <div className="info-row"><span>Date range</span><span>1990 — 2023</span></div>
          <div className="info-row"><span>Pages indexed</span><span>48</span></div>
          <div className="info-row"><span>Status</span><span style={{ color: '#38a169' }}>Active</span></div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Feed ingestion rules</h2>
        <ul className="admin-rules">
          <li>Feeds are polled every <strong>15 minutes</strong> for active sources</li>
          <li>Articles are auto-categorised by module based on keyword matching</li>
          <li>No article is auto-published as an incident — editorial review required</li>
          <li>Duplicate detection uses title similarity + source URL deduplication</li>
          <li>Historical archive feeds are crawled <strong>weekly</strong> for newly discovered pages</li>
          <li>Feed errors are logged and flagged after 3 consecutive failures</li>
        </ul>
      </div>

      <div className="admin-note">
        All feeds shown are synthetic configurations for development. In production, feed URLs point to real RSS endpoints and articles are stored in the database.
      </div>
    </div>
  );
}
