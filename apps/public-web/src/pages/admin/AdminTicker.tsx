import { useAppStore } from '@/stores/app-store';
import { TickerBar } from '../../components/TickerBar';
import { BottomTicker } from '../../components/BottomTicker';
import { useAuth } from '@/lib/hooks/useAuth';
import type { TickerConfig } from '@/stores/app-store';

interface TickerSectionProps {
  label: string;
  description: string;
  ticker: TickerConfig;
  update: (patch: Partial<TickerConfig>) => void;
  radioName: string;
  fontSizes: readonly number[];
  preview: React.ReactNode;
}

function TickerSection({ label, description, ticker, update, radioName, fontSizes, preview }: TickerSectionProps) {
  const rssFeeds = useAppStore((s) => s.rssFeeds);
  const enabledFeeds = rssFeeds.filter((f) => f.enabled);

  return (
    <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 16, marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 4px', color: 'var(--text-primary)' }}>{label}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>{description}</p>

      {/* On / off */}
      <div className="admin-card">
        <div className="feature-flag">
          <div className="flag-info">
            <div className="flag-label">Show this ticker</div>
            <div className="flag-desc">When off, nothing shows in this position.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={ticker.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Content source */}
      <div className="admin-card">
        <h2>Content</h2>
        <div className="ticker-mode-options">
          <label className={`ticker-mode-option${ticker.mode === 'rss' ? ' selected' : ''}`}>
            <input type="radio" name={radioName} checked={ticker.mode === 'rss'} onChange={() => update({ mode: 'rss' })} />
            <div>
              <div className="ticker-mode-title">News feed (RSS)</div>
              <div className="ticker-mode-desc">Latest headlines from an official news source.</div>
            </div>
          </label>
          <label className={`ticker-mode-option${ticker.mode === 'custom' ? ' selected' : ''}`}>
            <input type="radio" name={radioName} checked={ticker.mode === 'custom'} onChange={() => update({ mode: 'custom' })} />
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
              onChange={(e) => update({ rssFeedId: e.target.value || null })}
            >
              <option value="">All active feeds</option>
              {enabledFeeds.map((f) => (
                <option key={f.id} value={f.id}>{f.name} — {f.url.replace(/^https?:\/\//, '').split('/')[0]}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Ticker messages — one line per message</label>
            <textarea
              className="form-input"
              rows={5}
              value={ticker.customText}
              onChange={(e) => update({ customText: e.target.value })}
              placeholder={'Breaking: …\nReminder: …\nNotice: …'}
            />
            <div className="form-hint">Each line becomes a separate scrolling item.</div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="admin-card">
        <h2>Appearance</h2>
        <div className="form-group">
          <label className="form-label">Tone</label>
          <div className="ticker-dir-toggle">
            <button className={`btn btn-small${ticker.tone === 'normal' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ tone: 'normal' })}>
              Normal — white
            </button>
            <button className={`btn btn-small${ticker.tone === 'alert' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ tone: 'alert' })}>
              Alert — red
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Font weight</label>
          <div className="ticker-dir-toggle">
            <button className={`btn btn-small${!ticker.fontBold ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ fontBold: false })}>
              Normal
            </button>
            <button className={`btn btn-small${ticker.fontBold ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ fontBold: true })}>
              Bold
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Text colour</label>
          <div className="ticker-dir-toggle">
            {([['white', '#fff', 'White'], ['green', '#22c55e', 'Green'], ['yellow', '#eab308', 'Yellow'], ['red', '#ef4444', 'Red']] as const).map(([val, hex, lbl]) => (
              <button
                key={val}
                className={`btn btn-small${ticker.fontColor === val ? ' btn-primary' : ' btn-secondary'}`}
                onClick={() => update({ fontColor: val })}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: hex, border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }} />
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Font size: {ticker.fontSize || 14}px</label>
          <div className="ticker-dir-toggle">
            {fontSizes.map((sz) => (
              <button
                key={sz}
                className={`btn btn-small${(ticker.fontSize || 14) === sz ? ' btn-primary' : ' btn-secondary'}`}
                onClick={() => update({ fontSize: sz })}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Motion */}
      <div className="admin-card">
        <h2>Scroll behaviour</h2>
        <div className="form-group">
          <label className="form-label">Direction</label>
          <div className="ticker-dir-toggle">
            <button className={`btn btn-small${ticker.direction === 'rtl' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ direction: 'rtl' })}>
              Right → Left (standard)
            </button>
            <button className={`btn btn-small${ticker.direction === 'ltr' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ direction: 'ltr' })}>
              Left → Right
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Speed</label>
          <div className="ticker-dir-toggle">
            <button className={`btn btn-small${ticker.speedSeconds <= 45 ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ speedSeconds: 45 })}>
              Normal
            </button>
            <button className={`btn btn-small${ticker.speedSeconds === 50 ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ speedSeconds: 50 })}>
              10% slower
            </button>
            <button className={`btn btn-small${ticker.speedSeconds === 56 ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ speedSeconds: 56 })}>
              25% slower
            </button>
            <button className={`btn btn-small${ticker.speedSeconds === 68 ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ speedSeconds: 68 })}>
              50% slower
            </button>
            <button className={`btn btn-small${ticker.speedSeconds === 79 ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ speedSeconds: 79 })}>
              75% slower
            </button>
            <button className={`btn btn-small${ticker.speedSeconds === 83 ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ speedSeconds: 83 })}>
              85% slower
            </button>
            <button className={`btn btn-small${ticker.speedSeconds >= 86 ? ' btn-primary' : ' btn-secondary'}`} onClick={() => update({ speedSeconds: 86 })}>
              95% slower
            </button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="admin-card">
        <h2>Live preview</h2>
        {ticker.enabled ? (
          <div className="ticker-preview">{preview}</div>
        ) : (
          <div className="admin-note" style={{ margin: 0 }}>Ticker is off.</div>
        )}
      </div>
    </div>
  );
}

export function AdminTicker() {
  const { user } = useAuth();
  const isModerator = user?.role === 'moderator';
  const ticker = useAppStore((s) => s.ticker);
  const updateTicker = useAppStore((s) => s.updateTicker);
  const bottomTicker = useAppStore((s) => s.bottomTicker);
  const updateBottomTicker = useAppStore((s) => s.updateBottomTicker);

  if (isModerator) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1>Live Tickers</h1>
          <p>Edit custom ticker messages. Other settings are managed by admins.</p>
        </div>

        <div className="admin-card">
          <h2>Top banner — my own words</h2>
          <div className="form-group">
            <label className="form-label">Ticker messages — one line per message</label>
            <textarea
              className="form-input"
              rows={5}
              value={ticker.customText}
              onChange={(e) => updateTicker({ customText: e.target.value })}
              placeholder={'Breaking: …\nReminder: …\nNotice: …'}
            />
          </div>
        </div>

        <div className="admin-card">
          <h2>Bottom ticker — my own words</h2>
          <div className="form-group">
            <label className="form-label">Ticker messages — one line per message</label>
            <textarea
              className="form-input"
              rows={5}
              value={bottomTicker.customText}
              onChange={(e) => updateBottomTicker({ customText: e.target.value })}
              placeholder={'Breaking: …\nReminder: …\nNotice: …'}
            />
          </div>
        </div>

        <div className="admin-note">
          Moderators can edit custom ticker text. To change mode, appearance, speed, or toggle on/off, contact a platform admin.
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Live Tickers</h1>
        <p>Two independent scrolling tickers — the top banner across the very top of the page, and the bottom ticker below the impact summary on the map view.</p>
      </div>

      <TickerSection
        label="TOP BANNER"
        description="The thin scrolling bar pinned to the very top of the public site."
        ticker={ticker}
        update={updateTicker}
        radioName="top-ticker-mode"
        fontSizes={[12, 14, 18, 22, 28]}
        preview={<TickerBar />}
      />

      <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '8px 0 24px' }} />

      <TickerSection
        label="BOTTOM TICKER"
        description="The large scrolling ticker below the Impact Summary panel on the map view."
        ticker={bottomTicker}
        update={updateBottomTicker}
        radioName="bottom-ticker-mode"
        fontSizes={[28, 48, 72, 98, 128]}
        preview={<BottomTicker />}
      />

      <div className="admin-note">
        In production the RSS option pulls live articles from the selected feed. Each ticker operates independently — different content, colour, speed, and font size.
      </div>
    </div>
  );
}
