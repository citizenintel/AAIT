-- ============================================================
-- 00006: Incidents (public domain)
-- Published, editorially approved records
-- ============================================================

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category_id uuid not null references public.incident_categories(id),
  verification_state public.verification_state not null default 'v0_unreviewed',
  severity public.incident_severity not null default 'medium',
  status public.incident_status not null default 'active',
  bam_classification public.bam_classification not null default 'not_assessed',

  -- Time
  occurred_at timestamptz,
  occurred_at_precision text default 'exact' check (occurred_at_precision in ('exact', 'approximate', 'date_only', 'month_only', 'unknown')),
  occurred_end_at timestamptz, -- for ongoing events
  is_ongoing boolean not null default false,

  -- Content sections (§25)
  confirmed_facts text,
  reported_unconfirmed text,
  what_remains_unknown text,

  -- Context
  police_case_number text,
  court_reference text,

  -- Public victim summary (no private details)
  victim_count_confirmed int,
  victim_count_reported int,
  fatality_count_confirmed int,
  fatality_count_reported int,
  injury_count_confirmed int,

  -- Methodology
  methodology_version text not null default '1.0',
  taxonomy_version text not null default '1.0',

  -- Publishing
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  is_published boolean not null default false,

  -- Meta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create index idx_incidents_category on public.incidents(category_id);
create index idx_incidents_verification on public.incidents(verification_state);
create index idx_incidents_severity on public.incidents(severity);
create index idx_incidents_status on public.incidents(status);
create index idx_incidents_occurred on public.incidents(occurred_at);
create index idx_incidents_published on public.incidents(is_published, published_at);
create index idx_incidents_slug on public.incidents(slug);
create index idx_incidents_bam on public.incidents(bam_classification);

-- Full-text search
alter table public.incidents add column fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(confirmed_facts, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(reported_unconfirmed, '')), 'C')
  ) stored;

create index idx_incidents_fts on public.incidents using gin(fts);

-- Incident version history (§25 — every material edit)
create table public.incident_versions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  version_number int not null,
  changed_fields jsonb not null, -- what changed
  previous_values jsonb not null, -- previous state of changed fields
  change_reason text not null,
  changed_by uuid not null references public.profiles(id),
  methodology_version text not null,
  created_at timestamptz not null default now(),
  unique(incident_id, version_number)
);

create index idx_incident_versions_incident on public.incident_versions(incident_id);

-- Incident tags
create table public.incident_tags (
  incident_id uuid not null references public.incidents(id) on delete cascade,
  tag text not null,
  primary key (incident_id, tag)
);

-- Incident status history
create table public.incident_status_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  previous_state public.verification_state,
  new_state public.verification_state not null,
  previous_status public.incident_status,
  new_status public.incident_status,
  reason text,
  changed_by uuid references public.profiles(id),
  methodology_version text,
  created_at timestamptz not null default now()
);

create index idx_status_history_incident on public.incident_status_history(incident_id);

-- Incident relationships (§6.10)
create table public.incident_relationships (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  related_incident_id uuid not null references public.incidents(id),
  relationship_type text not null, -- 'related', 'escalation', 'continuation', 'duplicate', 'supersedes'
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (incident_id != related_incident_id)
);

create index idx_incident_rel_incident on public.incident_relationships(incident_id);
create index idx_incident_rel_related on public.incident_relationships(related_incident_id);

-- Incident organisations
create table public.incident_organisations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  organisation_name text not null,
  role text not null, -- 'victim_org', 'accused', 'respondent', 'investigator', 'observer'
  source_id uuid references public.sources(id),
  verification_state public.verification_state not null default 'v0_unreviewed',
  created_at timestamptz not null default now()
);

-- Now add FKs deferred from sources migration
alter table public.corroborations
  add constraint fk_corroboration_incident
  foreign key (incident_id) references public.incidents(id);

alter table public.contradictions
  add constraint fk_contradiction_incident
  foreign key (incident_id) references public.incidents(id);

alter table public.source_reliability_history
  add constraint fk_reliability_incident
  foreign key (incident_id) references public.incidents(id);
