import { useState, useEffect, useCallback } from 'react';
import {
  createBackup,
  restoreBackup,
  deleteBackup,
  listBackups,
  getBackupStats,
  isAutoBackupEnabled,
  setAutoBackupEnabled,
  startAutoBackup,
  stopAutoBackup,
  AUTO_INTERVAL_MS,
  MAX_SNAPSHOTS,
} from '@/lib/security/backup-service';
import { logAuditEvent } from '@/lib/security/mod-security';
import { useAuth } from '@/lib/hooks/useAuth';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminBackupRestore() {
  const { user } = useAuth();
  const [backups, setBackups] = useState(listBackups());
  const [stats, setStats] = useState(getBackupStats());
  const [autoEnabled, setAutoEnabled] = useState(isAutoBackupEnabled());
  const [manualLabel, setManualLabel] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    setBackups(listBackups());
    setStats(getBackupStats());
  }, []);

  useEffect(() => {
    startAutoBackup();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCreate = () => {
    setCreating(true);
    const label = manualLabel.trim() || `Manual backup`;
    createBackup(label, 'manual');
    logAuditEvent(user?.email ?? 'admin', 'backup_created', `Manual backup: ${label}`);
    setManualLabel('');
    refresh();
    setCreating(false);
  };

  const handleRestore = (id: string) => {
    const success = restoreBackup(id);
    if (success) {
      logAuditEvent(user?.email ?? 'admin', 'backup_restored', `Restored backup ${id}`);
      setRestoreSuccess(id);
      setTimeout(() => setRestoreSuccess(null), 3000);
    }
    setConfirmRestore(null);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteBackup(id);
    logAuditEvent(user?.email ?? 'admin', 'backup_deleted', `Deleted backup ${id}`);
    setConfirmDelete(null);
    refresh();
  };

  const toggleAuto = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    setAutoEnabled(enabled);
    if (enabled) {
      startAutoBackup();
    } else {
      stopAutoBackup();
    }
    logAuditEvent(user?.email ?? 'admin', 'auto_backup_toggle', `Auto backup ${enabled ? 'enabled' : 'disabled'}`);
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Backup & Restore</h1>
        <p>Automatic snapshots every {AUTO_INTERVAL_MS / 60000} minutes. Up to {MAX_SNAPSHOTS} snapshots retained.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Backups</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.auto}</div>
          <div className="stat-label">Automatic</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.manual}</div>
          <div className="stat-label">Manual</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatSize(stats.totalSizeBytes)}</div>
          <div className="stat-label">Total Size</div>
        </div>
      </div>

      {/* Auto backup toggle + manual backup */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="admin-card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Auto Backup</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Every {AUTO_INTERVAL_MS / 60000} minutes
                {stats.lastAuto && <> &middot; Last: {timeAgo(stats.lastAuto)}</>}
              </div>
            </div>
            <label className="toggle-switch" style={{ margin: 0 }}>
              <input type="checkbox" checked={autoEnabled} onChange={(e) => toggleAuto(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div style={{
            fontSize: 10, color: autoEnabled ? '#38a169' : '#ef4444',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: autoEnabled ? '#38a169' : '#ef4444' }} />
            {autoEnabled ? 'Running — snapshots are being created automatically' : 'Stopped — no automatic backups'}
          </div>
        </div>

        <div className="admin-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Manual Backup</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Label (optional)..."
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1, fontSize: 12 }}
            />
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {creating ? 'Creating...' : 'Backup Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Backup list */}
      {backups.length === 0 ? (
        <div className="admin-note">No backups yet. Create one manually or wait for the auto backup timer.</div>
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 80px 80px 130px',
            gap: 8, padding: '8px 16px',
            fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            <div>Label</div>
            <div>Time</div>
            <div>Type</div>
            <div>Size</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {backups.map((backup) => (
            <div
              key={backup.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 80px 80px 130px',
                gap: 8, padding: '10px 16px', alignItems: 'center',
                background: restoreSuccess === backup.id ? '#38a16912' : 'var(--bg-card)',
                borderRadius: 6,
                border: restoreSuccess === backup.id ? '1px solid #38a16933' : '1px solid transparent',
                transition: 'background 0.3s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {backup.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {timeAgo(backup.timestamp)}
              </div>
              <div>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                  padding: '2px 6px', borderRadius: 3,
                  background: backup.type === 'auto' ? '#3182ce18' : '#c9a84c18',
                  color: backup.type === 'auto' ? '#3182ce' : '#c9a84c',
                  textTransform: 'uppercase',
                }}>
                  {backup.type}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {formatSize(backup.sizeBytes)}
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {confirmRestore === backup.id ? (
                  <>
                    <button
                      className="btn btn-small"
                      style={{ fontSize: 10, background: '#38a16918', color: '#38a169', border: '1px solid #38a16933' }}
                      onClick={() => handleRestore(backup.id)}
                    >
                      Confirm
                    </button>
                    <button className="btn btn-small btn-secondary" onClick={() => setConfirmRestore(null)} style={{ fontSize: 10 }}>
                      Cancel
                    </button>
                  </>
                ) : confirmDelete === backup.id ? (
                  <>
                    <button
                      className="btn btn-small"
                      style={{ fontSize: 10, background: '#ef444418', color: '#ef4444', border: '1px solid #ef444433' }}
                      onClick={() => handleDelete(backup.id)}
                    >
                      Delete
                    </button>
                    <button className="btn btn-small btn-secondary" onClick={() => setConfirmDelete(null)} style={{ fontSize: 10 }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => setConfirmRestore(backup.id)}
                      style={{ fontSize: 10 }}
                      title={`Restore to ${formatTime(backup.timestamp)}`}
                    >
                      Restore
                    </button>
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => setConfirmDelete(backup.id)}
                      style={{ fontSize: 10, color: '#ef4444' }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-note" style={{ marginTop: 16 }}>
        Backups capture moderator credentials, audit logs, and security state. In production, backups are stored server-side with AES-256 encryption, retained for 90 days, and replicated to a geographically separate region.
      </div>
    </div>
  );
}
