const BACKUP_KEY = 'inteltwin_backups';
const BACKUP_META_KEY = 'inteltwin_backup_meta';
const MAX_SNAPSHOTS = 50;
const AUTO_INTERVAL_MS = 10 * 60 * 1000;

export interface BackupSnapshot {
  id: string;
  timestamp: number;
  label: string;
  type: 'auto' | 'manual';
  sizeBytes: number;
  data: string;
}

export interface BackupMeta {
  lastAutoBackup: number;
  totalBackups: number;
  autoEnabled: boolean;
}

function generateBackupId(): string {
  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getBackupMeta(): BackupMeta {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    return raw ? JSON.parse(raw) : { lastAutoBackup: 0, totalBackups: 0, autoEnabled: true };
  } catch {
    return { lastAutoBackup: 0, totalBackups: 0, autoEnabled: true };
  }
}

function saveBackupMeta(meta: BackupMeta): void {
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
}

function getAllBackups(): BackupSnapshot[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAllBackups(backups: BackupSnapshot[]): void {
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
}

function captureStoreState(): string {
  const keysToBackup = [
    'inteltwin_mod_credentials',
    'inteltwin_audit_log',
    'inteltwin_login_attempts',
  ];

  const snapshot: Record<string, unknown> = {};

  for (const key of keysToBackup) {
    const val = localStorage.getItem(key);
    if (val) snapshot[key] = JSON.parse(val);
  }

  try {
    snapshot['_idb_status'] = typeof indexedDB !== 'undefined' ? 'idb_available' : 'idb_unavailable';
  } catch {
    // skip
  }

  return JSON.stringify(snapshot);
}

export function createBackup(label: string, type: 'auto' | 'manual' = 'manual'): BackupSnapshot {
  const data = captureStoreState();
  const snapshot: BackupSnapshot = {
    id: generateBackupId(),
    timestamp: Date.now(),
    label,
    type,
    sizeBytes: new Blob([data]).size,
    data,
  };

  const backups = getAllBackups();
  backups.unshift(snapshot);

  if (backups.length > MAX_SNAPSHOTS) {
    const autoBackups = backups.filter((b) => b.type === 'auto');
    const manualBackups = backups.filter((b) => b.type === 'manual');

    while (autoBackups.length > MAX_SNAPSHOTS - manualBackups.length && autoBackups.length > 5) {
      autoBackups.pop();
    }

    const trimmed = [...manualBackups, ...autoBackups]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_SNAPSHOTS);
    saveAllBackups(trimmed);
  } else {
    saveAllBackups(backups);
  }

  const meta = getBackupMeta();
  meta.totalBackups++;
  if (type === 'auto') meta.lastAutoBackup = Date.now();
  saveBackupMeta(meta);

  return snapshot;
}

export function restoreBackup(backupId: string): boolean {
  const backups = getAllBackups();
  const backup = backups.find((b) => b.id === backupId);
  if (!backup) return false;

  try {
    const data: Record<string, unknown> = JSON.parse(backup.data);

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_')) continue;
      localStorage.setItem(key, JSON.stringify(value));
    }

    return true;
  } catch {
    return false;
  }
}

export function deleteBackup(backupId: string): boolean {
  const backups = getAllBackups();
  const filtered = backups.filter((b) => b.id !== backupId);
  if (filtered.length === backups.length) return false;
  saveAllBackups(filtered);
  return true;
}

export function listBackups(): Omit<BackupSnapshot, 'data'>[] {
  return getAllBackups().map(({ data: _data, ...rest }) => rest);
}

export function getBackupById(backupId: string): BackupSnapshot | null {
  const backups = getAllBackups();
  return backups.find((b) => b.id === backupId) ?? null;
}

export function getBackupStats(): {
  total: number;
  auto: number;
  manual: number;
  totalSizeBytes: number;
  lastAuto: number | null;
  oldestTimestamp: number | null;
} {
  const backups = getAllBackups();
  return {
    total: backups.length,
    auto: backups.filter((b) => b.type === 'auto').length,
    manual: backups.filter((b) => b.type === 'manual').length,
    totalSizeBytes: backups.reduce((sum, b) => sum + b.sizeBytes, 0),
    lastAuto: backups.find((b) => b.type === 'auto')?.timestamp ?? null,
    oldestTimestamp: backups.length > 0 ? backups[backups.length - 1]!.timestamp : null,
  };
}

export function setAutoBackupEnabled(enabled: boolean): void {
  const meta = getBackupMeta();
  meta.autoEnabled = enabled;
  saveBackupMeta(meta);
}

export function isAutoBackupEnabled(): boolean {
  return getBackupMeta().autoEnabled;
}

// ---------------------------------------------------------------------------
// Auto-backup timer (runs in browser)
// ---------------------------------------------------------------------------

let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoBackup(): void {
  if (autoBackupTimer) return;

  const meta = getBackupMeta();
  if (!meta.autoEnabled) return;

  if (Date.now() - meta.lastAutoBackup > AUTO_INTERVAL_MS) {
    createBackup('Auto backup', 'auto');
  }

  autoBackupTimer = setInterval(() => {
    if (!isAutoBackupEnabled()) {
      stopAutoBackup();
      return;
    }
    createBackup('Auto backup', 'auto');
  }, AUTO_INTERVAL_MS);
}

export function stopAutoBackup(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

export { AUTO_INTERVAL_MS, MAX_SNAPSHOTS };
