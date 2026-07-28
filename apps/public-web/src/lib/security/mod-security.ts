import { hashPassword } from './password-generator';

const MOD_SESSION_KEY = 'inteltwin_mod_session';
const AUDIT_LOG_KEY = 'inteltwin_audit_log';
const LOGIN_ATTEMPTS_KEY = 'inteltwin_login_attempts';
const MOD_CREDENTIALS_KEY = 'inteltwin_mod_credentials';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const MOD_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_REFRESH_MS = 5 * 60 * 1000;

export interface ModSession {
  email: string;
  token: string;
  createdAt: number;
  lastActivity: number;
  fingerprint: string;
}

export interface AuditEntry {
  timestamp: number;
  email: string;
  action: string;
  detail: string;
  ip: string;
}

interface LoginAttemptRecord {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

export interface ModCredential {
  email: string;
  passwordHash: string;
  createdAt: number;
  mustChangePassword: boolean;
  lastLogin: number | null;
}

function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getBrowserFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fp', 2, 2);
  }
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas.toDataURL().slice(-50),
  ];
  let hash = 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ---------------------------------------------------------------------------
// Credential storage (demo: localStorage; production: server-side DB)
// ---------------------------------------------------------------------------

export function getModCredentials(): Record<string, ModCredential> {
  try {
    const raw = localStorage.getItem(MOD_CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function storeModCredential(email: string, password: string): Promise<void> {
  const creds = getModCredentials();
  creds[email] = {
    email,
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
    mustChangePassword: true,
    lastLogin: null,
  };
  localStorage.setItem(MOD_CREDENTIALS_KEY, JSON.stringify(creds));
}

export function removeModCredential(email: string): void {
  const creds = getModCredentials();
  delete creds[email];
  localStorage.setItem(MOD_CREDENTIALS_KEY, JSON.stringify(creds));
}

// ---------------------------------------------------------------------------
// Rate limiting & lockout
// ---------------------------------------------------------------------------

function getLoginAttempts(): Record<string, LoginAttemptRecord> {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLoginAttempts(data: Record<string, LoginAttemptRecord>): void {
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
}

export function isAccountLocked(email: string): { locked: boolean; remainingMs: number } {
  const attempts = getLoginAttempts();
  const record = attempts[email];
  if (!record?.lockedUntil) return { locked: false, remainingMs: 0 };
  const remaining = record.lockedUntil - Date.now();
  if (remaining <= 0) {
    record.count = 0;
    record.lockedUntil = null;
    saveLoginAttempts(attempts);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: remaining };
}

export function recordLoginAttempt(email: string, success: boolean): void {
  const attempts = getLoginAttempts();
  if (!attempts[email]) {
    attempts[email] = { count: 0, lastAttempt: 0, lockedUntil: null };
  }
  const record = attempts[email]!;

  if (success) {
    record.count = 0;
    record.lockedUntil = null;
  } else {
    record.count++;
    record.lastAttempt = Date.now();
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
  }
  saveLoginAttempts(attempts);
}

export function getRemainingAttempts(email: string): number {
  const attempts = getLoginAttempts();
  const record = attempts[email];
  if (!record) return MAX_LOGIN_ATTEMPTS;
  return Math.max(0, MAX_LOGIN_ATTEMPTS - record.count);
}

// ---------------------------------------------------------------------------
// Mod sessions (separate from main auth)
// ---------------------------------------------------------------------------

export function createModSession(email: string): ModSession {
  const session: ModSession = {
    email,
    token: generateSessionToken(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    fingerprint: getBrowserFingerprint(),
  };
  localStorage.setItem(MOD_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getModSession(): ModSession | null {
  try {
    const raw = localStorage.getItem(MOD_SESSION_KEY);
    if (!raw) return null;
    const session: ModSession = JSON.parse(raw);

    if (Date.now() - session.lastActivity > MOD_SESSION_TIMEOUT_MS) {
      destroyModSession();
      return null;
    }

    if (session.fingerprint !== getBrowserFingerprint()) {
      destroyModSession();
      return null;
    }

    if (Date.now() - session.lastActivity > SESSION_REFRESH_MS) {
      session.lastActivity = Date.now();
      session.token = generateSessionToken();
      localStorage.setItem(MOD_SESSION_KEY, JSON.stringify(session));
    }

    return session;
  } catch {
    return null;
  }
}

export function refreshModSession(): void {
  const session = getModSession();
  if (session) {
    session.lastActivity = Date.now();
    localStorage.setItem(MOD_SESSION_KEY, JSON.stringify(session));
  }
}

export function destroyModSession(): void {
  localStorage.removeItem(MOD_SESSION_KEY);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function getAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logAuditEvent(email: string, action: string, detail: string): void {
  const log = getAuditLog();
  log.unshift({
    timestamp: Date.now(),
    email,
    action,
    detail,
    ip: 'client',
  });
  if (log.length > 500) log.length = 500;
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(log));
}

export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_LOG_KEY);
}

export { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS, MOD_SESSION_TIMEOUT_MS };
