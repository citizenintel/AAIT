import { supabase, isSupabaseConfigured } from '../supabase';
import { MOCK_USERS } from '../../data/mock-users';

export interface UserRow {
  id: string;
  display_name: string;
  email: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  isDemo: boolean;
}

let mockRows: UserRow[] | null = null;

function getMockRows(): UserRow[] {
  if (!mockRows) {
    mockRows = MOCK_USERS.map(u => ({
      id: u.id,
      display_name: u.name,
      email: u.email,
      role: u.role === 'admin' ? 'system_administrator' : u.role === 'moderator' ? 'triage_moderator' : 'registered_contributor',
      permissions: [...u.permissions],
      is_active: true,
      created_at: u.registeredAt,
      isDemo: u.isDemo,
    }));
  }
  return mockRows;
}

export async function fetchUsers(): Promise<UserRow[]> {
  if (!isSupabaseConfigured()) return getMockRows();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(`
      id, display_name, is_active, created_at,
      roles:user_roles(role, is_active)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (profiles ?? []).map(p => {
    const activeRoles = (p.roles ?? []).filter((r: any) => r.is_active);
    const topRole = activeRoles[0]?.role ?? 'registered_contributor';
    return {
      id: p.id,
      display_name: p.display_name,
      email: '',
      role: topRole,
      permissions: roleToPermissions(topRole),
      is_active: p.is_active,
      created_at: p.created_at,
      isDemo: false,
    };
  });
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const rows = getMockRows();
    const idx = rows.findIndex(u => u.id === userId);
    if (idx !== -1) {
      Object.assign(rows[idx]!, { role, permissions: roleToPermissions(role) });
    }
    return;
  }

  await supabase
    .from('user_roles')
    .update({ is_active: false })
    .eq('user_id', userId);

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role, is_active: true, granted_at: new Date().toISOString() }, { onConflict: 'user_id,role' });

  if (error) throw new Error(error.message);
}

export async function updateUserPermissions(userId: string, permissions: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    const rows = getMockRows();
    const idx = rows.findIndex(u => u.id === userId);
    if (idx !== -1) {
      Object.assign(rows[idx]!, { permissions: [...permissions] });
    }
    return;
  }

  const { error } = await supabase
    .from('user_permissions')
    .upsert({ user_id: userId, permissions, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) throw new Error(error.message);
}

export async function createMockUser(name: string, email: string): Promise<UserRow> {
  const row: UserRow = {
    id: `user-${Date.now().toString(36)}`,
    display_name: name,
    email,
    role: 'registered_contributor',
    permissions: [],
    is_active: true,
    created_at: new Date().toISOString(),
    isDemo: false,
  };
  if (!isSupabaseConfigured()) {
    getMockRows().unshift(row);
    return row;
  }
  throw new Error('User creation goes through the auth signup flow');
}

export async function deactivateUser(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const rows = getMockRows();
    const idx = rows.findIndex(u => u.id === userId);
    if (idx !== -1) Object.assign(rows[idx]!, { is_active: false });
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

function roleToPermissions(role: string): string[] {
  const perms: Record<string, string[]> = {
    system_administrator: ['approve_submissions', 'approve_incidents', 'edit_incidents', 'reply_reporters', 'print_reports', 'import_data', 'manage_feeds', 'manage_sponsors', 'ai_summarise', 'view_sensitive'],
    senior_editor: ['approve_submissions', 'approve_incidents', 'edit_incidents', 'reply_reporters', 'print_reports', 'ai_summarise', 'view_sensitive'],
    triage_moderator: ['approve_submissions', 'reply_reporters', 'print_reports'],
    registered_contributor: [],
  };
  return perms[role] ?? [];
}
