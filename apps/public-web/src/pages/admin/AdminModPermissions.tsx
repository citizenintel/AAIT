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
  const setModPermission = useAppStore((s) => s.setModPermission);
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
          <div className="stat-value">{emails.filter(e => activeCount(e) > 2).length}</div>
          <div className="stat-label">Extended access</div>
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
          const isExpanded = expandedEmail === email;
          const count = activeCount(email);
          const activeLabels = PERMISSION_LABELS.filter(p => perms[p.key]).map(p => p.label);

          return (
            <div key={email} style={{ borderRadius: isExpanded ? 10 : 8, overflow: 'hidden', border: isExpanded ? '1px solid var(--border)' : '1px solid transparent' }}>
              {/* Email row — clickable */}
              <div
                onClick={() => setExpandedEmail(isExpanded ? null : email)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: isExpanded ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                }}
                onMouseOver={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseOut={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-card)'; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isExpanded ? '#3182ce' : '#3182ce33',
                  color: isExpanded ? '#fff' : '#3182ce',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                  transition: 'all 0.15s',
                }}>
                  {email.charAt(0).toUpperCase()}
                </div>

                {/* Email + status */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {count === 0 ? 'No permissions' : activeLabels.join(', ')}
                  </div>
                </div>

                {/* Permission count badge */}
                <div style={{
                  padding: '3px 8px', borderRadius: 12,
                  background: count > 0 ? '#3182ce22' : 'var(--bg-elevated)',
                  color: count > 0 ? '#3182ce' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                }}>
                  {count}/{PERMISSION_LABELS.length}
                </div>

                {/* Expand chevron */}
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>

              {/* Expanded permissions panel */}
              {isExpanded && (
                <div style={{ padding: '12px 16px', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {PERMISSION_LABELS.map(({ key, label, desc }) => (
                      <div
                        key={key}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6,
                          border: perms[key] ? '1px solid #3182ce33' : '1px solid var(--border)',
                          transition: 'border-color 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: perms[key] ? '#3182ce' : '#4a556833',
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
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Footer: active summary + remove */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {count > 0
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
