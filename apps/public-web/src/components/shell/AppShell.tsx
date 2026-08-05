import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/app-store';
import { detectRenderingTier, setTierOverride } from '@/lib/rendering-tier';
import { MISSION_LENSES } from '@/types/ontology';
import { GlanceView } from '@/components/glance/GlanceView';
import { InvestigateView } from '@/components/investigate/InvestigateView';
import { BriefView } from '@/components/brief/BriefView';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { TickerBar } from '@/components/TickerBar';
import { TimeFilterDropdown } from '@/components/shell/TimeFilterDropdown';
import { ReviewQueueBanner } from '@/components/shell/ReviewQueueBanner';
import { AddressSearch } from '@/components/AddressSearch';
import { IncidentListView } from '@/components/IncidentListView';
import { useURLSync } from '@/lib/hooks/useURLSync';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { fetchEvents } from '@/lib/api/events';
import { fetchAssets } from '@/lib/api/assets';
import type { InterfaceLevel, RenderingTier } from '@/types/ontology';

const LEVEL_LABELS: Record<InterfaceLevel, string> = {
  glance: 'Glance',
  investigate: 'Investigate',
  brief: 'Brief',
};

const TIER_CYCLE: RenderingTier[] = ['essential', 'enhanced', 'cinematic'];

export function AppShell() {
  useAutoRefresh();
  const navigate = useNavigate();
  const isAuth = useAppStore((s) => s.auth.isAuthenticated);
  const user = useAppStore((s) => s.auth.user);
  const interfaceLevel = useAppStore((s) => s.interfaceLevel);
  const renderingTier = useAppStore((s) => s.renderingTier);
  const activeLens = useAppStore((s) => s.activeLens);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const overallHealth = useAppStore((s) => s.overallHealth);
  const unacknowledgedCount = useAppStore((s) => s.unacknowledgedCount);

  const setInterfaceLevel = useAppStore((s) => s.setInterfaceLevel);
  const setRenderingTier = useAppStore((s) => s.setRenderingTier);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const addEvents = useAppStore((s) => s.addEvents);
  const addAssets = useAppStore((s) => s.addAssets);
  const hydrate = useAppStore((s) => s.hydrate);

  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  const [lensOpen, setLensOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const lensRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Init: detect tier, hydrate, load mock data
  useEffect(() => {
    const tier = detectRenderingTier();
    setRenderingTier(tier);
    document.documentElement.setAttribute('data-tier', tier);

    hydrate().then(async () => {
      const [events, assets] = await Promise.all([fetchEvents(), fetchAssets()]);
      addEvents(events);
      addAssets(assets);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // SELECT was missing from this guard. The year picker in
      // TimeFilterDropdown is a <select>, and typing a digit into it to jump to
      // a year would otherwise switch the whole interface level mid-selection.
      if (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' || target.isContentEditable
      ) return;

      if (e.key === '1') { e.preventDefault(); setInterfaceLevel('glance'); }
      if (e.key === '2') { e.preventDefault(); setInterfaceLevel('investigate'); }
      if (e.key === '3') { e.preventDefault(); setInterfaceLevel('brief'); }
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setLensOpen(false);
      }
    },
    [setInterfaceLevel, setCommandPaletteOpen, commandPaletteOpen],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const alerts = useAppStore((s) => s.alerts);
  const acknowledgeAlert = useAppStore((s) => s.acknowledgeAlert);

  // Close lens/alerts dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (lensRef.current && !lensRef.current.contains(e.target as Node)) setLensOpen(false);
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const cycleTier = () => {
    const idx = TIER_CYCLE.indexOf(renderingTier);
    const next = TIER_CYCLE[(idx + 1) % TIER_CYCLE.length]!;
    setRenderingTier(next);
    setTierOverride(next);
    document.documentElement.setAttribute('data-tier', next);
  };

  const tickerEnabled = useAppStore((s) => s.ticker.enabled);
  const viewMode = useAppStore((s) => s.ui.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);

  useURLSync();

  const alertCount = unacknowledgedCount();
  const hasCritical = alertCount > 0;

  return (
    <div className="app-shell">
      {tickerEnabled && <TickerBar />}
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-freshness" data-health={overallHealth} />
          <span className="app-header-name">AAIT</span>
        </div>

        <button
          className="layers-toggle"
          data-active={sidebarOpen}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Toggle layer controls"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
          </svg>
          Layers
        </button>

        <div className="app-header-spacer" />

        <div className="level-switcher">
          {(['glance', 'investigate', 'brief'] as InterfaceLevel[]).map((level, i) => (
            <button
              key={level}
              className="level-tab"
              data-active={interfaceLevel === level}
              onClick={() => setInterfaceLevel(level)}
            >
              {LEVEL_LABELS[level]}
              <span className="level-tab-shortcut">{i + 1}</span>
            </button>
          ))}
        </div>

        <div className="app-header-spacer" />

        <div className="lens-selector" ref={lensRef}>
          <button className="lens-selector-trigger" onClick={() => setLensOpen(!lensOpen)}>
            {activeLens ? activeLens.name : 'All Signals'}
            <span style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
          </button>
          {lensOpen && (
            <div className="lens-dropdown">
              <button
                className="lens-option"
                data-active={activeLens === null}
                onClick={() => { setActiveLens(null); setLensOpen(false); }}
              >
                <span className="lens-option-name">All Signals</span>
                <span className="lens-option-desc">No filter — show everything</span>
              </button>
              {MISSION_LENSES.map((lens) => (
                <button
                  key={lens.id}
                  className="lens-option"
                  data-active={activeLens?.id === lens.id}
                  onClick={() => { setActiveLens(lens); setLensOpen(false); }}
                >
                  <span className="lens-option-name">{lens.name}</span>
                  <span className="lens-option-desc">{lens.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Second filter control, sibling to "All Signals". The active time
            window is always stated on its trigger — a filter you cannot see is
            indistinguishable from a broken map. */}
        <TimeFilterDropdown />

        <div className="view-toggle">
          <button
            className="view-toggle-btn"
            data-active={viewMode === 'map'}
            onClick={() => setViewMode('map')}
          >MAP</button>
          <button
            className="view-toggle-btn"
            data-active={viewMode === 'list'}
            onClick={() => setViewMode('list')}
          >LIST</button>
        </div>

        <button className="header-nav-btn" onClick={() => navigate('/about')}>About</button>
        <button className="header-nav-btn" onClick={() => navigate('/methodology')}>Methodology</button>
        <button className="header-nav-btn accent" onClick={() => navigate('/report')}>+ Report</button>

        <div className="lens-selector" ref={alertsRef}>
          <button className="alert-indicator" data-critical={hasCritical} onClick={() => setAlertsOpen(!alertsOpen)}>
            🔔
            <span className="alert-count" data-severity={hasCritical ? 'critical' : undefined}>
              {alertCount}
            </span>
          </button>
          {alertsOpen && (
            <div className="lens-dropdown" style={{ right: 0, left: 'auto', minWidth: 280, maxHeight: 320, overflowY: 'auto' }}>
              <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>
                Alerts {alertCount > 0 && `(${alertCount} new)`}
              </div>
              {alerts.length === 0 ? (
                <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No alerts</div>
              ) : (
                alerts.slice(0, 10).map((a) => (
                  <button
                    key={a.id}
                    className="lens-option"
                    style={{ opacity: a.acknowledged ? 0.5 : 1 }}
                    onClick={() => { acknowledgeAlert(a.id); if (a.eventId) { useAppStore.getState().selectEvent(a.eventId); setAlertsOpen(false); } }}
                  >
                    <span className="lens-option-name" style={{ color: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f59e0b' : 'var(--text-primary)' }}>
                      {a.title}
                    </span>
                    <span className="lens-option-desc">{a.description.slice(0, 80)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {isAuth ? (
          <button className="header-nav-btn" onClick={() => navigate('/admin')} title={`Logged in as ${user?.displayName}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Admin
          </button>
        ) : (
          <button className="header-nav-btn" onClick={() => navigate('/login')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
            Login
          </button>
        )}

        <button className="tier-indicator" onClick={cycleTier} title="Click to change rendering tier">
          {renderingTier}
        </button>
      </header>

      {/* Withheld-import notice. Mounted here so it covers Glance, Investigate
          and Brief with one instance, and because this tree is inside
          IncidentDataProvider (App.tsx:38) — /admin/* is not. */}
      <ReviewQueueBanner />
      <AddressSearch />

      <div className="app-content">
        {viewMode === 'list' ? (
          <IncidentListView />
        ) : (
          <div key={interfaceLevel} className="level-panel" style={{ height: '100%' }}>
            {interfaceLevel === 'glance' && <GlanceView />}
            {interfaceLevel === 'investigate' && <InvestigateView />}
            {interfaceLevel === 'brief' && <BriefView />}
          </div>
        )}
      </div>

      {commandPaletteOpen && <CommandPalette />}
    </div>
  );
}
