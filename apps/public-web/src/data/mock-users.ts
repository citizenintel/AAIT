export type UserRole = 'reader' | 'moderator' | 'admin';

export type PermissionKey =
  | 'approve_submissions'
  | 'approve_incidents'
  | 'edit_incidents'
  | 'reply_reporters'
  | 'print_reports'
  | 'import_data'
  | 'manage_feeds'
  | 'manage_sponsors'
  | 'ai_summarise'
  | 'view_sensitive';

export const PERMISSIONS: { key: PermissionKey; label: string; desc: string }[] = [
  { key: 'approve_submissions', label: 'Approve submissions', desc: 'Publish citizen reports after review' },
  { key: 'approve_incidents', label: 'Approve incidents', desc: 'Sign off on incidents before they appear on the map' },
  { key: 'edit_incidents', label: 'Edit incidents', desc: 'Change details, severity and verification of incidents' },
  { key: 'reply_reporters', label: 'Reply to reporters', desc: 'Send follow-up messages to people who submitted reports' },
  { key: 'print_reports', label: 'Print / export reports', desc: 'Generate and export incident reports' },
  { key: 'import_data', label: 'Import data', desc: 'Bring records in from CSV / spreadsheet files' },
  { key: 'manage_feeds', label: 'Manage news feeds', desc: 'Add, remove and configure RSS sources' },
  { key: 'manage_sponsors', label: 'Manage sponsors', desc: 'Edit sponsor placements' },
  { key: 'ai_summarise', label: 'Use AI summary tool', desc: 'Run the AI summariser on submissions to draft a public map entry' },
  { key: 'view_sensitive', label: 'View / share sensitive data', desc: 'See names, emails, case numbers; share them only when granted' },
];

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: PermissionKey[]; // ignored for admin (admins have everything)
  registeredAt: string;
  isDemo: boolean;
}

// All seeded accounts are DEMO so real vs. demo is obvious later.
export const MOCK_USERS: AppUser[] = [
  { id: 'usr-001', name: 'Henri (JJ) DEMO', email: 'admin@altafrikaner.com', role: 'admin', permissions: [], registeredAt: '2026-06-01', isDemo: true },
  { id: 'usr-002', name: 'Senior Editor DEMO', email: 'editor@altafrikaner.com', role: 'moderator', permissions: ['approve_submissions', 'approve_incidents', 'edit_incidents', 'reply_reporters', 'print_reports'], registeredAt: '2026-06-10', isDemo: true },
  { id: 'usr-003', name: 'Regional Mod DEMO', email: 'mod.limpopo@altafrikaner.com', role: 'moderator', permissions: ['approve_submissions', 'reply_reporters'], registeredAt: '2026-07-02', isDemo: true },
  { id: 'usr-004', name: 'Thabo M. DEMO', email: 'thabo.demo@example.com', role: 'reader', permissions: [], registeredAt: '2026-07-14', isDemo: true },
  { id: 'usr-005', name: 'Marika V. DEMO', email: 'marika.demo@example.com', role: 'reader', permissions: [], registeredAt: '2026-07-18', isDemo: true },
  { id: 'usr-006', name: 'New Registrant DEMO', email: 'pending.demo@example.com', role: 'reader', permissions: [], registeredAt: '2026-07-21', isDemo: true },
];
