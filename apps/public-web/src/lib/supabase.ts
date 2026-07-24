import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = () =>
  Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== '<public-project-url>');

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';

export const supabase: SupabaseClient = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || 'placeholder-key',
);

export const editorial = () => supabase.schema('editorial');
export const evidence = () => supabase.schema('evidence');
export const sponsor = () => supabase.schema('sponsor');
export const audit = () => supabase.schema('audit');
