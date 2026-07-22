-- ============================================================
-- 00005: Source system
-- Source independence tracking per §24
-- ============================================================

-- Publishers
create table public.source_publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  url text,
  country text default 'ZA',
  publisher_type text, -- newspaper, broadcaster, wire_service, government, ngo, etc.
  ownership_group_id uuid, -- FK added after ownership_groups created
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ownership groups (for source independence calculation)
create table public.source_ownership_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.source_publishers
  add constraint fk_publisher_ownership_group
  foreign key (ownership_group_id)
  references public.source_ownership_groups(id);

-- Individual source documents/articles
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid references public.source_publishers(id),
  source_type public.source_type not null,
  title text,
  canonical_url text,
  publication_date timestamptz,
  update_date timestamptz,
  language text default 'en',
  summary text, -- permitted summary, not full reproduction
  underlying_source_id uuid references public.sources(id), -- syndication chain
  is_original boolean not null default true,
  ingestion_time timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sources_publisher on public.sources(publisher_id);
create index idx_sources_url on public.sources(canonical_url);
create index idx_sources_type on public.sources(source_type);
create index idx_sources_publication_date on public.sources(publication_date);

-- Source-to-incident links with independence tracking
create table public.corroborations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null, -- FK added in incidents migration
  source_id uuid not null references public.sources(id),
  facts_supported text[], -- which claims this source supports
  facts_contradicted text[], -- which claims this source contradicts
  is_independent boolean not null default true, -- false if syndicated from another linked source
  reviewer_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_corroborations_incident on public.corroborations(incident_id);
create index idx_corroborations_source on public.corroborations(source_id);

-- Contradictions (separate from corroborations for clarity)
create table public.contradictions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null, -- FK added in incidents migration
  source_id uuid not null references public.sources(id),
  contradicted_claim text not null,
  contradicting_claim text not null,
  severity text not null default 'minor' check (severity in ('minor', 'material', 'fundamental')),
  resolution text, -- how contradiction was resolved
  reviewer_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Source reliability history
create table public.source_reliability_history (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.source_publishers(id),
  event_type text not null, -- 'correction_required', 'retraction', 'confirmed_accurate', etc.
  description text,
  incident_id uuid, -- FK added later
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
