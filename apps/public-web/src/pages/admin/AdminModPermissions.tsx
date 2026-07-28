import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { ModPermissions } from '@/stores/app-store';
import { generateSecurePassword } from '@/lib/security/password-generator';
import { storeModCredential, removeModCredential, logAuditEvent } from '@/lib/security/mod-security';
import { useAuth } from '@/lib/hooks/useAuth';

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
  const { user } = useAuth();
  const modPermissions = useAppStore((s) => s.modPermissions);
  const modEnabled = useAppStore((s) => s.modEnabled);
  const setModPermission = useAppStore((s) => s.setModPermission);
  const setModEnabled = useAppStore((s) => s.setModEnabled);
  const addModerator = useAppStore((s) => s.addModerator);
  const removeModerator = useAppStore((s) => s.removeModerator);
  const [newEmail, setNewEmail] = useState('');
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [generatedCreds, setGeneratedCreds] = useState<{ email: string; password: string } | null>(null);
  const [sending, setSending] = useState(false);

  const emails = Object.keys(modPermissions);

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (modPermissions[email]) return;

    setSending(true);

    const password = generateSecurePassword(8);

    addModerator(email);
    await storeModCredential(email, password);

    logAuditEvent(
      user?.email ?? 'admin',
      'moderator_added',
      `Added moderator ${email} with generated credentials`,
    );

    setGeneratedCreds({ email, password });
    setNewEmail('');
    setSending(false);
  };

  const handleRemove = (email: string) => {
    removeModerator(email);
    removeModCredential(email);
    logAuditEvent(
      user?.email ?? 'admin',
      'moderator_removed',
      `Removed moderator ${email}`,
    );
    setConfirmRemove(null);
    setExpandedEmail(null);
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

      {/* Generated credentials modal */}
      {generatedCreds && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#1a2332', border: '1px solid #c9a84c55', borderRadius: 12,
            padding: '28px 32px', maxWidth: 480, width: '90%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#38a16922',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38a169" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Moderator Added</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Credentials generated — send securely</div>
              </div>
            </div>

            <div style={{
              background: '#111827', borderRadius: 8, padding: '16px 20px',
              border: '1px solid #c9a84c33', marginBottom: 16,
            }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{generatedCreds.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Generated Password</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#c9a84c', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{generatedCreds.password}</div>
              </div>
            </div>

            <div style={{
              background: '#ef444412', border: '1px solid #ef444422', borderRadius: 6,
              padding: '8px 12px', marginBottom: 16,
              fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <strong>Security notice:</strong> This password is shown only once. Copy it now and send it to the moderator through a secure channel (not email). The moderator must change it on first login.
              </div>
            </div>

            <div style={{
              background: '#3182ce12', border: '1px solid #3182ce22', borderRadius: 6,
              padding: '8px 12px', marginBottom: 20,
              fontSize: 11, color: '#3182ce', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
              In production, this password will be emailed automatically via a secure, encrypted channel.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-small btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(`Email: ${generatedCreds.email}\nPassword: ${generatedCreds.password}`);
                }}
                style={{ fontSize: 12 }}
              >
                Copy to clipboard
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setGeneratedCreds(null);
                  setExpandedEmail(generatedCreds.email);
                }}
                style={{ fontSize: 12 }}
              >
                Done — I've saved the credentials
              </button>
            </div>
          </div>
        </div>
      )}

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
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!newEmail.includes('@') || sending || !!modPermissions[newEmail.trim().toLowerCase()]}
          >
            {sending ? 'Generating...' : '+ Add'}
          </button>
        </div>
        {newEmail.includes('@') && modPermissions[newEmail.trim().toLowerCase()] && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
            This email is already a moderator.
          </div>
        )}
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
                    onChange={(e) => {
                      setModEnabled(email, e.target.checked);
                      logAuditEvent(
                        user?.email ?? 'admin',
                        e.target.checked ? 'moderator_enabled' : 'moderator_suspended',
                        `${e.target.checked ? 'Enabled' : 'Suspended'} moderator ${email}`,
                      );
                    }}
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
                            onChange={(e) => {
                              setModPermission(email, key, e.target.checked);
                              logAuditEvent(
                                user?.email ?? 'admin',
                                'permission_changed',
                                `${e.target.checked ? 'Granted' : 'Revoked'} ${label} for ${email}`,
                              );
                            }}
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
                          onClick={() => handleRemove(email)}
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
        Moderator credentials are hashed and stored separately from the main auth system. In production, passwords are emailed via encrypted channel and credentials are stored server-side with bcrypt hashing.
      </div>
    </div>
  );
}
