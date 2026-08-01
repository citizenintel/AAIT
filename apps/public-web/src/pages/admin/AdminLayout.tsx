import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import type { ModPermissions } from '@/stores/app-store';

const NAV_ITEMS: { to: string; label: string; icon: string; end?: true; modPermKey?: keyof ModPermissions; adminOnly?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', end: true, modPermKey: 'dashboard' },
  { to: '/admin/incidents', label: 'Incidents', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', modPermKey: 'incidents' },
  { to: '/admin/submissions', label: 'Submissions', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z', modPermKey: 'submissions' },
  { to: '/admin/sponsors', label: 'Sponsors', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM14 8h.01', adminOnly: true },
  { to: '/admin/widgets', label: 'Widgets', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z', adminOnly: true },
  { to: '/admin/feeds', label: 'News Feeds', icon: 'M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z', modPermKey: 'feeds' },
  { to: '/admin/ticker', label: 'Live Ticker', icon: 'M3 8h18M3 8l2 8a2 2 0 002 2h10a2 2 0 002-2l2-8M8 12h8', modPermKey: 'ticker' },
  { to: '/admin/reports', label: 'Reports', icon: 'M9 17v-6h6v6M9 7h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z', modPermKey: 'reports' },
  { to: '/admin/import', label: 'Import Data', icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12', modPermKey: 'import' },
  { to: '/admin/security', label: 'Upload Security', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4', adminOnly: true },
  { to: '/admin/mod-permissions', label: 'Mod Permissions', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', adminOnly: true },
  { to: '/admin/backup', label: 'Backup & Restore', icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M8 2v3M16 2v3M12 11v6M9 14l3 3 3-3', adminOnly: true },
  { to: '/admin/users', label: 'Users & Roles', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', adminOnly: true },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', adminOnly: true },
  { to: '/admin/synthetic', label: 'Test Data', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', adminOnly: true },
  { to: '/admin/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', adminOnly: true },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut } = useAuth();
  const modPermissions = useAppStore((s) => s.modPermissions);
  const modEnabled = useAppStore((s) => s.modEnabled);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => { hydrate(); }, [hydrate]);

  if (!isAuthenticated) return null;

  const isModerator = user?.role === 'moderator';
  const isModActive = isModerator && user?.email ? modEnabled[user.email] !== false : true;
  const userPerms = isModerator && user?.email && isModActive ? modPermissions[user.email] : null;

  const visibleNav = isModerator
    ? isModActive
      ? NAV_ITEMS.filter(item => {
          if (item.adminOnly) return false;
          if (item.modPermKey && userPerms) return userPerms[item.modPermKey];
          if (item.modPermKey && !userPerms) return item.modPermKey === 'dashboard' || item.modPermKey === 'ticker';
          return false;
        })
      : []
    : NAV_ITEMS;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand" onClick={() => navigate('/')}>
          <div className="admin-brand-title">AAIT</div>
          <div className="admin-brand-sub">Admin Console</div>
        </div>

        <nav className="admin-nav">
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user">
            <div className="admin-user-avatar">{user?.displayName?.charAt(0) ?? 'A'}</div>
            <div>
              <div className="admin-user-name">{user?.displayName}</div>
              <div className="admin-user-role">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
          </div>
          <button className="admin-logout" onClick={async () => { await signOut(); navigate('/'); }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
