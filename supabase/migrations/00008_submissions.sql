-- ============================================================
-- 00008: Submissions (editorial domain)
-- Private reports — separate from public incidents (§21)
-- ============================================================

create table editorial.submissions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.profiles(id),
  status editorial.submission_status not null default 'draft',
  category_id uuid not null references public.incident_categories(id),
  knowledge_type editorial.knowledge_type not null default 'unknown',
  attribution_preference public.attribution_preference not null default 'publicly_anonymous',

  -- When (§29 step 3)
  occurred_at timestamptz,
  occurred_at_precision text default 'exact' check (occurred_at_precision in ('exact', 'approximate', 'date_only', 'month_only', 'unknown')),
  occurred_end_at timestamptz,
  is_ongoing boolean not null default false,
  date_learned timestamptz,

  -- Free-text account (§29 step 7)
  narrative text,

  -- Official references (§29 step 9)
  police_case_number text,
  court_reference text,
  municipal_notice text,
  official_statement text,
  organisation_reference text,

  -- Motive indicators reported by contributor (§29 step 10)
  reported_motive_statements text,
  reported_motive_evidence text,

  -- Declaration (§29 step 14)
  declared_truthful boolean not null default false,
  uncertainty_disclosed boolean not null default false,
  evidence_unaltered boolean not null default false,
  accepts_review boolean not null default false,

  -- Admin
  assigned_to uuid references public.profiles(id),
  linked_incident_id uuid references public.incidents(id),
  rejection_reason text,
  internal_notes text, -- never public

  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_submissions_contributor on editorial.submissions(contributor_id);
create index idx_submissions_status on editorial.submissions(status);
create index idx_submissions_category on editorial.submissions(category_id);
create index idx_submissions_assigned on editorial.submissions(assigned_to);
create index idx_submissions_submitted on editorial.submissions(submitted_at);

-- Submission versions
create table editorial.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references editorial.submissions(id) on delete cascade,
  version_number int not null,
  snapshot jsonb not null,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(submission_id, version_number)
);

-- Structured answers (§29 step 6 — category-specific fields)
create table editorial.submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references editorial.submissions(id) on delete cascade,
  field_key text not null,
  field_value text,
  field_type text not null default 'text', -- text, number, boolean, date, select
  sort_order int not null default 0
);

create index idx_submission_answers_submission on editorial.submission_answers(submission_id);

-- Submission locations (private, full precision)
create table editorial.submission_locations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references editorial.submissions(id) on delete cascade,
  precise_point public.geometry(Point, 4326),
  gps_accuracy_meters float,
  province text,
  district text,
  municipality text,
  town text,
  address text,
  property_type text,
  property_name text,
  road_name text,
  police_station_area text,
  suggested_public_tier public.location_tier default 'l4_approximate_cell',
  location_sensitivity_notes text,
  created_at timestamptz not null default now()
);

create index idx_submission_locations_submission on editorial.submission_locations(submission_id);
create index idx_submission_locations_point on editorial.submission_locations using gist(precise_point);

-- Submission sources (links, references provided by contributor)
create table editorial.submission_sources (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references editorial.submissions(id) on delete cascade,
  url text,
  description text,
  source_type public.source_type,
  created_at timestamptz not null default now()
);

-- People affected (§29 step 8 — sensitive, private)
create table editorial.submission_persons (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references editorial.submissions(id) on delete cascade,
  role text not null, -- 'victim', 'witness', 'suspect', 'reporter', 'other'
  description text, -- what happened to this person
  age_range text, -- 'child', 'adult', 'elderly' — not exact age unless necessary
  is_deceased boolean not null default false,
  is_injured boolean not null default false,
  created_at timestamptz not null default now()
);

-- Submission status history
create table editorial.submission_status_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references editorial.submissions(id) on delete cascade,
  previous_status editorial.submission_status,
  new_status editorial.submission_status not null,
  reason text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_submission_status_history on editorial.submission_status_history(submission_id);

-- Now add FK from private_locations to submissions
alter table editorial.private_locations
  add constraint fk_private_location_submission
  foreign key (submission_id) references editorial.submissions(id);
