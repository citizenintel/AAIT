import { useAppStore } from '../../store/app-store';
import { MOCK_RSS_FEEDS } from '../../data/mock-news';
import { TickerBar } from '../../components/TickerBar';

export function AdminTicker() {
  const ticker = useAppStore((s) => s.ticker);
  const updateTicker = useAppStore((s) => s.updateTicker);

  const enabledFeeds = MOCK_RSS_FEEDS.filter((f) => f.enabled);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Live Ticker</h1>
        <p>The scrolling banner at the very top of the public map. Turn it on or off, and choose whether it shows a news feed or your own words.</p>
      </div>

      {/* On / off */}
      <div className="admin-card">
        <div className="feature-flag">
          <div className="flag-info">
            <div className="flag-label">Show ticker on the site</div>
            <div className="flag-desc">When off, the banner is removed entirely and the map fills that space.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={ticker.enabled} onChange={(e) => updateTicker({ enabled: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Content source */}
      <div className="admin-card">
        <h2>What the ticker shows</h2>
        <div className="ticker-mode-options">
          <label className={`ticker-mode-option${ticker.mode === 'rss' ? ' selected' : ''}`}>
            <input type="radio" name="ticker-mode" checked={ticker.mode === 'rss'} onChange={() => updateTicker({ mode: 'rss' })} />
            <div>
              <div className="ticker-mode-title">News feed (RSS)</div>
              <div className="ticker-mode-desc">Latest headlines from an official news source.</div>
            </div>
          </label>
          <label className={`ticker-mode-option${ticker.mode === 'custom' ? ' selected' : ''}`}>
            <input type="radio" name="ticker-mode" checked={ticker.mode === 'custom'} onChange={() => updateTicker({ mode: 'custom' })} />
            <div>
              <div className="ticker-mode-title">My own words</div>
              <div className="ticker-mode-desc">Type the exact messages to scroll.</div>
            </div>
          </label>
        </div>

        {ticker.mode === 'rss' ? (
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">News source</label>
            <select
              className="form-input"
              value={ticker.rssFeedId ?? ''}
              onChange={(e) => updateTicker({ rssFeedId: e.target.value || null })}
            >
              <option value="">All active feeds</option>
              {enabledFeeds.map((f) => (
                <option key={f.id} value={f.id}>{f.name} — {f.url.replace(/^https?:\/\//, '').split('/')[0]}</option>
              ))}
            </select>
            <div className="form-hint">Feeds are managed under News Feeds. Only active feeds appear here.</div>
          </div>
        ) : (
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Ticker messages — one line per message</label>
            <textarea
              className="form-input"
              rows={5}
              value={ticker.customText}
              onChange={(e) => updateTicker({ customText: e.target.value })}
              placeholder={'Breaking: …\nReminder: …\nNotice: …'}
            />
            <div className="form-hint">Each line becomes a separate scrolling item, separated by a dot.</div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="admin-card">
        <h2>Appearance</h2>
        <div className="form-group">
          <label className="form-label">Tone</label>
          <div className="ticker-dir-toggle">
            <button className={`btn btn-small${ticker.tone === 'normal' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => updateTicker({ tone: 'normal' })}>
              Normal — white
            </button>
            <button className={`btn btn-small${ticker.tone === 'alert' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => updateTicker({ tone: 'alert' })}>
              Alert — red
            </button>
          </div>
          <div className="form-hint">Normal shows bright white text. Alert switches the whole bar to an urgent red treatment for warnings.</div>
        </div>
      </div>

      {/* Motion */}
      <div className="admin-card">
        <h2>Scroll behaviour</h2>
        <div className="form-group">
          <label className="form-label">Direction</label>
          <div className="ticker-dir-toggle">
            <button className={`btn btn-small${ticker.direction === 'rtl' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => updateTicker({ direction: 'rtl' })}>
              Right → Left (standard)
            </button>
            <button className={`btn btn-small${ticker.direction === 'ltr' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => updateTicker({ direction: 'ltr' })}>
              Left → Right
            </button>
          </div>
          <div className="form-hint">Right-to-left is the conventional, most readable news ticker.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Speed — {ticker.speedSeconds}s per loop {ticker.speedSeconds <= 25 ? '(fast)' : ticker.speedSeconds >= 60 ? '(slow)' : '(medium)'}</label>
          <input
            type="range"
            min={15}
            max={90}
            step={5}
            value={ticker.speedSeconds}
            onChange={(e) => updateTicker({ speedSeconds: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="admin-card">
        <h2>Live preview</h2>
        {ticker.enabled ? (
          <div className="ticker-preview">
            <TickerBar />
          </div>
        ) : (
          <div className="admin-note" style={{ margin: 0 }}>Ticker is off — nothing shows on the site.</div>
        )}
      </div>

      <div className="admin-note">
        In production the RSS option pulls live articles from the selected feed. Article text always appears on-site — source addresses are shown as plain text, never as outbound links.
      </div>
    </div>
  );
}
