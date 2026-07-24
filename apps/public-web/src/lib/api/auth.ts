import { supabase, isSupabaseConfigured } from '../supabase';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    return demoSignIn(email, password);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign in failed');

  return fetchUserProfile(data.user);
}

export async function signUp(email: string, password: string, displayName: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Registration requires a configured database');

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession(): Promise<{ user: AppUser; session: Session } | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;

  const user = await fetchUserProfile(session.user);
  return { user, session };
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, user: AppUser | null) => void) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const user = await fetchUserProfile(session.user);
      callback(event, user);
    } else {
      callback(event, null);
    }
  });

  return { unsubscribe: () => subscription.unsubscribe() };
}

async function fetchUserProfile(user: User): Promise<AppUser> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, organisation')
    .eq('id', user.id)
    .single();

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('granted_at', { ascending: false });

  const topRole = roles?.[0]?.role ?? 'registered_contributor';

  return {
    id: user.id,
    email: user.email ?? '',
    displayName: profile?.display_name ?? user.user_metadata?.display_name ?? 'Contributor',
    role: topRole,
    avatarUrl: user.user_metadata?.avatar_url,
  };
}

function demoSignIn(email: string, password: string): AppUser {
  if (password !== 'demo') throw new Error('Invalid credentials');

  const demos: Record<string, AppUser> = {
    'admin@altafrikaner.com': {
      id: 'demo-admin',
      email: 'admin@altafrikaner.com',
      displayName: 'Admin User',
      role: 'system_administrator',
    },
    'editor@altafrikaner.com': {
      id: 'demo-editor',
      email: 'editor@altafrikaner.com',
      displayName: 'Editor User',
      role: 'senior_editor',
    },
  };

  const user = demos[email];
  if (!user) throw new Error('Invalid credentials');
  return user;
}
