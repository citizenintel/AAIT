-- ============================================================
-- 00004: Accounts, profiles, and role system
-- Does NOT duplicate Supabase Auth password/session data
-- ============================================================

-- Profiles — public-facing contributor data
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  attribution_preference public.attribution_preference not null default 'publicly_anonymous',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'af')),
  organisation text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing contributor profile. No sensitive identity data here.';

-- Roles
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.app_role not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- User-role assignments (many-to-many)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  unique(user_id, role)
);

create index idx_user_roles_user on public.user_roles(user_id);
create index idx_user_roles_role on public.user_roles(role);

-- Contributor preferences
create table public.contributor_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_province text,
  default_municipality text,
  email_notifications boolean not null default true,
  push_notifications boolean not null default false,
  low_data_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Notification preferences
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_slug text references public.incident_categories(slug),
  province text,
  municipality text,
  severity_minimum public.incident_severity,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_notification_prefs_user on public.notification_preferences(user_id);

-- ────────────────────────────────────────────────────────
-- RLS helper functions
-- ────────────────────────────────────────────────────────

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
$$;

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
      and is_active = true
      and (expires_at is null or expires_at > now())
  )
$$;

create or replace function public.has_any_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = any(required_roles)
      and is_active = true
      and (expires_at is null or expires_at > now())
  )
$$;

-- Seed default roles
insert into public.roles (name, description) values
  ('visitor', 'Unauthenticated public user'),
  ('registered_contributor', 'Registered contributor who can submit reports'),
  ('verified_contributor', 'Contributor with verified identity'),
  ('researcher', 'Researcher with extended read access'),
  ('triage_moderator', 'Can triage incoming submissions'),
  ('evidence_reviewer', 'Can review uploaded evidence'),
  ('identity_reviewer', 'Can access identity verification vault'),
  ('senior_editor', 'Can approve and publish incidents'),
  ('legal_reviewer', 'Can review legal risk and approve sensitive content'),
  ('source_manager', 'Manages data sources and ingestion'),
  ('sponsor_manager', 'Manages sponsor campaigns'),
  ('billing_administrator', 'Manages billing and subscriptions'),
  ('system_administrator', 'System configuration and health'),
  ('security_administrator', 'Security audit and access control');

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Contributor'));

  insert into public.user_roles (user_id, role)
  values (new.id, 'registered_contributor');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
