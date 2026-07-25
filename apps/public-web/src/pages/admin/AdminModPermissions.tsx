import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { ModPermissions } from '@/stores/app-store';

const PERMISSION_LABELS: { key: keyof ModPermissions; label: string; desc: string }[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'View dashboard stats and charts' },
  { key: 'ticker', label: 'Live Ticker', desc: 'Edit custom ticker text ("my own words")' },
  { key: 'incidents', label: 'View Incidents', desc: 'Browse the incidents list' },
  { key: 'submissions', label: 'Submissions', desc: 'View and triage public submissions' },
  { key: 'reports', label: 'Reports', desc: 'Generate and print reports' },
  { key: 'feeds', label: 'News Feeds', desc: 'View feed sources and articles' },
  { key: 'import', label: 'Import Data', desc: 'Access the data import tool' },
  { key: 'exportPrint', label: 'Print & Export', desc: 'Print reports and export as CSV, XLS, DOCX' },
];

export function AdminModPermissions() {
  const modPermissions = useAppStore((s) => s.modPermissions);
  const modEnabled = useAppStore((s) => s.modEnabled);
  const setModPermission = useAppStore((s) => s.setModPermission);
  const setModEnabled = useAppStore((s) => s.setModEnabled);
  const addModerator = useAppStore((s) => s.addModerator);
  const removeModerator = useAppStore((s) => s.removeModerator);
  const [newEmail, setNewEmail] = useState('');
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const emails = Object.keys(modPermissions);

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    addModerator(email);
    setNewEmail('');
    setExpandedEmail(email);
  };

  const activeCount = (email: string) => {
    const perms = modPermissions[email];
    if (!perms) return 0;
    return PERMISSION_LABELS.filter(p => perms[p.key]).length;
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Moderator Permissions</h1>
        <p>Control what each moderator can see and do. Click an email to manage permissions.</p>
      </div>

      {/* Stats bar */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{emails.length}</div>
          <div className="stat-label">Moderators</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{PERMISSION_LABELS.length}</div>
          <div className="stat-label">Permission areas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{emails.filter(e => modEnabled[e] !== false).length}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{emails.filter(e => modEnabled[e] === false).length}</div>
          <div className="stat-label">Suspended</div>
        </div>
      </div>

      {/* Add moderator */}
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            className="form-input"
            placeholder="Add moderator by email..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={!newEmail.includes('@')}>
            + Add
          </button>
        </div>
      </div>

      {/* Moderator list */}
      {emails.length === 0 && (
        <div className="admin-note">No moderators configured. Add one above to get started.</div>
      )}

      <div style={{ display: 'grid', gap: 2 }}>
        {emails.map((email) => {
          const perms = modPermissions[email]!;
          const enabled = modEnabled[email] !== false;
          const isExpanded = expandedEmail === email;
          const count = activeCount(email);
          const activeLabels = PERMISSION_LABELS.filter(p => perms[p.key]).map(p => p.label);

          return (
            <div
              key={email}
              style={{
                borderRadius: isExpanded ? 10 : 8, overflow: 'hidden',
                border: isExpanded ? '1px solid var(--border)' : '1px solid transparent',
                opacity: enabled ? 1 : 0.55,
                transition: 'opacity 0.2s',
              }}
            >
              {/* Email row */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: isExpanded ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Master enable/disable toggle */}
                <label
                  className="toggle-switch"
                  style={{ margin: 0, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  title={enabled ? 'Disable all permissions' : 'Enable all permissions'}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setModEnabled(email, e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>

                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: enabled ? (isExpanded ? '#3182ce' : '#3182ce33') : '#4a556833',
                  color: enabled ? (isExpanded ? '#fff' : '#3182ce') : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
                  onClick={() => setExpandedEmail(isExpanded ? null : email)}
                >
                  {email.charAt(0).toUpperCase()}
                </div>

                {/* Email + status — clickable area */}
                <div
                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  onClick={() => setExpandedEmail(isExpanded ? null : email)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email}
                    </span>
                    {!enabled && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: '#ef4444', background: '#ef444418', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>
                        Suspended
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{enabled ? (count === 0 ? 'No permissions' : activeLabels.join(', ')) : 'All permissions disabled'}</span>
                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', opacity: 0.7 }}>— click to manage</span>
                  </div>
                </div>

                {/* Permission count badge */}
                <div
                  style={{
                    padding: '3px 8px', borderRadius: 12,
                    background: enabled && count > 0 ? '#3182ce22' : 'var(--bg-elevated)',
                    color: enabled && count > 0 ? '#3182ce' : 'var(--text-muted)',
                    fontSize: 11, fontWeight: 600, flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedEmail(isExpanded ? null : email)}
                >
                  {count}/{PERMISSION_LABELS.length}
                </div>

                {/* Expand chevron */}
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', cursor: 'pointer' }}
                  onClick={() => setExpandedEmail(isExpanded ? null : email)}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>

              {/* Expanded permissions panel */}
              {isExpanded && (
                <div style={{ padding: '12px 16px', background: 'var(--bg-card)' }}>
                  {!enabled && (
                    <div style={{
                      padding: '8px 12px', marginBottom: 10, borderRadius: 6,
                      background: '#ef444412', border: '1px solid #ef444422',
                      fontSize: 11, color: '#ef4444',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      Moderator suspended — all permissions are disabled. Toggle the master switch to re-enable.
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: 4 }}>
                    {PERMISSION_LABELS.map(({ key, label, desc }) => (
                      <div
                        key={key}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6,
                          border: enabled && perms[key] ? '1px solid #3182ce33' : '1px solid var(--border)',
                          transition: 'border-color 0.15s',
                          opacity: enabled ? 1 : 0.5,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: enabled && perms[key] ? '#3182ce' : '#4a556833',
                            transition: 'background 0.15s',
                          }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{desc}</div>
                          </div>
                        </div>
                        <label className="toggle-switch" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={perms[key]}
                            onChange={(e) => setModPermission(email, key, e.target.checked)}
                            disabled={!enabled}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {!enabled
                        ? 'Suspended — no access until re-enabled'
                        : count > 0
                          ? `${count} of ${PERMISSION_LABELS.length} permissions active`
                          : 'No permissions — this moderator has read-only access'
                      }
                    </div>
                    {confirmRemove === email ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-small"
                          style={{ background: '#c5303018', color: '#ef4444', border: '1px solid #ef444433', fontSize: 11 }}
                          onClick={() => { removeModerator(email); setConfirmRemove(null); setExpandedEmail(null); }}
                        >
                          Confirm remove
                        </button>
                        <button className="btn btn-small btn-secondary" onClick={() => setConfirmRemove(null)} style={{ fontSize: 11 }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={(e) => { e.stopPropagation(); setConfirmRemove(email); }}
                        style={{ color: '#ef4444', fontSize: 11 }}
                      >
                        Remove moderator
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="admin-note" style={{ marginTop: 16 }}>
        Permissions are stored in-memory for this demo. In production, moderator permissions are persisted to the database and synced across sessions.
      </div>
    </div>
  );
}
