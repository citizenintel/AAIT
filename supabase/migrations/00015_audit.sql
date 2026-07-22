-- ============================================================
-- 00015: Audit system (audit domain)
-- Append-only logs per §20.11
-- ============================================================

-- Audit log (append-only, covers all domains)
create table audit.logs (
  id uuid primary key default gen_random_uuid(),
  category audit.event_category not null,
  action text not null,
  actor_id uuid references public.profiles(id),
  actor_role public.app_role,
  target_type text, -- 'incident', 'submission', 'evidence', 'identity', 'sponsor', etc.
  target_id uuid,
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb, -- additional context
  ip_address inet,
  methodology_version text,
  created_at timestamptz not null default now()
);

create index idx_audit_category on audit.logs(category);
create index idx_audit_actor on audit.logs(actor_id);
create index idx_audit_target on audit.logs(target_type, target_id);
create index idx_audit_created on audit.logs(created_at);

-- Prevent updates and deletes on audit log
create or replace function audit.prevent_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit logs are append-only and cannot be modified or deleted';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on audit.logs
  for each row execute function audit.prevent_modification();

-- Feature flags (§18)
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  provider text,
  status public.capability_status not null default 'disabled',
  quota_used int,
  quota_limit int,
  cost_threshold_cents int,
  fallback_provider text,
  health_status text default 'healthy' check (health_status in ('healthy', 'degraded', 'failing')),
  last_success_at timestamptz,
  config jsonb,
  description text,
  updated_at timestamptz not null default now()
);

-- Seed core feature flags
insert into public.feature_flags (key, enabled, status, description) values
  ('map_provider', true, 'active', 'Map tile provider (maplibre default)'),
  ('satellite_imagery', false, 'disabled', 'Satellite imagery layer'),
  ('photorealistic_3d', false, 'disabled', '3D map view'),
  ('geocoding', false, 'disabled', 'Address-to-coordinate lookup'),
  ('email_notifications', false, 'disabled', 'Email notification delivery'),
  ('push_notifications', false, 'disabled', 'Push notification delivery'),
  ('malware_scanning', false, 'disabled', 'Evidence file malware scanning'),
  ('ai_assistance', false, 'disabled', 'AI-powered extraction and suggestions'),
  ('translation', false, 'disabled', 'Automatic translation'),
  ('payments', false, 'disabled', 'Payment processing'),
  ('sponsorship', false, 'disabled', 'Sponsor display system'),
  ('news_ingestion', false, 'disabled', 'Automated news feed ingestion'),
  ('bulk_import', false, 'disabled', 'Spreadsheet/file bulk import'),
  ('data_export', false, 'disabled', 'Data export for researchers'),
  ('analytics_dashboard', false, 'disabled', 'Internal analytics dashboard');

-- Methodology versions (track changes to scoring/classification methods)
create table public.methodology_versions (
  id uuid primary key default gen_random_uuid(),
  domain text not null, -- 'verification', 'bias_assessment', 'taxonomy', 'resilience', 'source_independence'
  version text not null,
  description text not null,
  changes_from_previous text,
  effective_from timestamptz not null default now(),
  document_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(domain, version)
);

insert into public.methodology_versions (domain, version, description) values
  ('verification', '1.0', 'Initial verification state machine: V0–V5, VX, VR, VA'),
  ('bias_assessment', '1.0', 'Initial Bias Assessment Matrix: structured human review, no automated scoring'),
  ('taxonomy', '1.0', 'Initial incident taxonomy: ait, unrest_watch, national_monitor, infrastructure_watch, natural_events'),
  ('source_independence', '1.0', 'Initial source independence: ownership-group based deduplication');
