import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from '@/lib/hooks/useAuth';
import { useIncidentData } from '@/lib/hooks/useIncidentData';

export function TopBar() {
  const { incidents } = useIncidentData();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated: isAuth, user } = useAuth();
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const searchQuery = useAppStore((s) => s.filters.searchQuery);

  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (value: string) => {
    setLocalQuery(value);
    setSearchQuery(value);
  };

  const dismissedIds = useAppStore((s) => s.dismissedAlertIds);
  const dismissAlert = useAppStore((s) => s.dismissAlert);
  const dismissAllAlerts = useAppStore((s) => s.dismissAllAlerts);

  const criticalAlerts = incidents.filter(i => i.severity === 'critical');
  const activeAlerts = criticalAlerts.filter(i => !dismissedIds[i.id]);
  const activeCount = activeAlerts.length;
  const isMap = location.pathname === '/';

  return (
    <header className="topbar">
      <div className="topbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <div className="topbar-title">AAIT</div>
        <div className="topbar-context">Live situational awareness for South Africa</div>
      </div>

      <div className="topbar-spacer" />

      {isMap ? (
        searchOpen ? (
          <div className="topbar-search active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={localQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search incidents, locations, tags..."
              className="topbar-search-input"
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); handleSearch(''); } }}
            />
            {localQuery && (
              <button className="topbar-search-clear" onClick={() => { handleSearch(''); searchRef.current?.focus(); }}>×</button>
            )}
          </div>
        ) : (
          <div className="topbar-search" onClick={() => setSearchOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <span>Search incidents, locations...</span>
          </div>
        )
      ) : (
        <nav className="topbar-nav">
          <button className="topbar-nav-btn" onClick={() => navigate('/')}>Map</button>
          <button className="topbar-nav-btn" onClick={() => navigate('/about')}>About</button>
          <button className="topbar-nav-btn" onClick={() => navigate('/methodology')}>Methodology</button>
        </nav>
      )}

      <div className="topbar-actions">
        <div ref={alertsRef} style={{ position: 'relative' }}>
          <button className="topbar-btn" onClick={() => setAlertsOpen(!alertsOpen)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            Alerts
            {activeCount > 0 && <span className="topbar-badge">{activeCount}</span>}
          </button>
          {alertsOpen && (
            <div className="topbar-dropdown alerts-dropdown">
              <div className="dropdown-header">
                <span>Recent Alerts</span>
                {activeCount > 0 && (
                  <button
                    className="dropdown-clear-all"
                    onClick={(e) => { e.stopPropagation(); dismissAllAlerts(activeAlerts.map(a => a.id)); }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {activeAlerts.length === 0 ? (
                <div className="dropdown-empty">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  <span>No new alerts</span>
                  <span className="dropdown-empty-sub">New critical incidents will appear here</span>
                </div>
              ) : (
                activeAlerts.slice(0, 5).map(inc => (
                  <div key={inc.id} className="dropdown-item">
                    <span className="dropdown-dot" style={{ background: '#c53030' }} />
                    <div className="dropdown-item-content" onClick={() => { setAlertsOpen(false); navigate(`/incident/${inc.id}`); }}>
                      <div className="dropdown-item-title">{inc.title}</div>
                      <div className="dropdown-item-meta">{inc.town} — {inc.dateOccurred}</div>
                    </div>
                    <button
                      className="dropdown-item-dismiss"
                      onClick={(e) => { e.stopPropagation(); dismissAlert(inc.id); }}
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
              <div className="dropdown-footer">All incidents are synthetic test data</div>
            </div>
          )}
        </div>

        <button className="topbar-btn primary" onClick={() => navigate('/report')}>
          + Report
        </button>

        {isAuth ? (
          <button className="topbar-btn" onClick={() => navigate('/admin')} title={`Logged in as ${user?.displayName}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            Admin
          </button>
        ) : (
          <button className="topbar-btn" onClick={() => navigate('/login')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Login
          </button>
        )}
      </div>
    </header>
  );
}
