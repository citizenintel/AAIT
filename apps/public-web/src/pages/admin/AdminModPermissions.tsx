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
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const emails = Object.keys(modPermissions);

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    addModerator(email);
    setNewEmail('');
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Moderator Permissions</h1>
        <p>Control what each moderator can see and do. Permissions apply when a user with the moderator role signs in.</p>
      </div>

      <div className="admin-card">
        <h2>Add moderator</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            className="form-input"
            placeholder="moderator@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={!newEmail.includes('@')}>
            + Add
          </button>
        </div>
        <div className="form-hint">Add a moderator email to manage their permissions. The account must use the moderator role to see these restrictions.</div>
      </div>

      {emails.length === 0 && (
        <div className="admin-note">No moderators configured. Add one above to manage permissions.</div>
      )}

      {emails.map((email) => {
        const perms = modPermissions[email]!;
        return (
          <div key={email} className="admin-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15 }}>{email}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Moderator</div>
              </div>
              {confirmRemove === email ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-small" style={{ background: '#c5303018', color: '#ef4444', border: '1px solid #ef444433' }} onClick={() => { removeModerator(email); setConfirmRemove(null); }}>
                    Confirm remove
                  </button>
                  <button className="btn btn-small btn-secondary" onClick={() => setConfirmRemove(null)}>Cancel</button>
                </div>
              ) : (
                <button className="btn btn-small btn-secondary" onClick={() => setConfirmRemove(email)} style={{ color: '#ef4444' }}>
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              {PERMISSION_LABELS.map(({ key, label, desc }) => (
                <div
                  key={key}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <label className="toggle-switch">
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

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
              Active permissions: {PERMISSION_LABELS.filter(p => perms[p.key]).map(p => p.label).join(', ') || 'None'}
            </div>
          </div>
        );
      })}

      <div className="admin-note">
        Permissions are stored in-memory for this demo. In production, moderator permissions are persisted to the database and synced across sessions.
      </div>
    </div>
  );
}
