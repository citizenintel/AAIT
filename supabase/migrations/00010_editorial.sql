-- ============================================================
-- 00010: Editorial workflow
-- Review, approval, corrections, retractions per §34–36
-- ============================================================

-- Moderation reviews
create table editorial.moderation_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references editorial.submissions(id),
  reviewer_id uuid not null references public.profiles(id),
  action editorial.editorial_action not null,
  previous_status editorial.submission_status,
  new_status editorial.submission_status,
  reason text not null,
  methodology_version text not null default '1.0',
  created_at timestamptz not null default now()
);

create index idx_reviews_submission on editorial.moderation_reviews(submission_id);
create index idx_reviews_reviewer on editorial.moderation_reviews(reviewer_id);

-- Editorial decisions (for incidents)
create table editorial.editorial_decisions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  decision_type editorial.editorial_action not null,
  decision_by uuid not null references public.profiles(id),
  reason text not null,
  previous_verification public.verification_state,
  new_verification public.verification_state,
  methodology_version text not null default '1.0',
  created_at timestamptz not null default now()
);

create index idx_decisions_incident on editorial.editorial_decisions(incident_id);

-- Two-person approval tracking (§35)
create table editorial.approval_requirements (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  requirement_reason text not null, -- why two-person needed
  required_approvals int not null default 2,
  created_at timestamptz not null default now()
);

create table editorial.approval_actions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references editorial.approval_requirements(id),
  approver_id uuid not null references public.profiles(id),
  action text not null check (action in ('approve', 'reject', 'request_changes')),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_approvals_requirement on editorial.approval_actions(requirement_id);

-- Corrections (§36)
create table editorial.corrections (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  correction_type text not null check (correction_type in ('factual', 'contextual', 'attribution', 'location', 'classification', 'other')),
  original_claim text not null,
  corrected_claim text not null,
  reason text not null,
  source_id uuid references public.sources(id),
  requested_by uuid references public.profiles(id), -- could be external challenge
  reviewed_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  is_public boolean not null default true,
  correction_notice text, -- public-facing explanation
  created_at timestamptz not null default now()
);

create index idx_corrections_incident on editorial.corrections(incident_id);

-- Retractions
create table editorial.retractions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  reason text not null,
  retraction_notice text not null, -- public-facing
  retracted_by uuid not null references public.profiles(id),
  approved_by uuid not null references public.profiles(id),
  retain_public_notice boolean not null default true, -- §36: retracted must retain notice unless safety requires removal
  created_at timestamptz not null default now()
);

-- Disputes
create table editorial.disputes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  disputed_claim text not null,
  dispute_basis text not null,
  evidence_provided text,
  source_id uuid references public.sources(id),
  raised_by uuid references public.profiles(id),
  status text not null default 'open' check (status in ('open', 'under_review', 'upheld', 'rejected', 'partially_upheld')),
  reviewer_id uuid references public.profiles(id),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_disputes_incident on editorial.disputes(incident_id);
create index idx_disputes_status on editorial.disputes(status);

-- Conflicts of interest
create table editorial.conflicts_of_interest (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id),
  incident_id uuid references public.incidents(id),
  submission_id uuid references editorial.submissions(id),
  conflict_type text not null, -- 'personal_connection', 'organisational', 'financial', 'political', 'geographic'
  description text not null,
  declared_at timestamptz not null default now()
);

-- Duplicate candidates
create table editorial.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references editorial.submissions(id),
  incident_id uuid references public.incidents(id),
  candidate_incident_id uuid references public.incidents(id),
  candidate_submission_id uuid references editorial.submissions(id),
  similarity_reasons jsonb not null, -- { time_distance, geo_distance, category_match, text_similarity, etc. }
  geographic_distance_km float,
  time_distance_hours float,
  resolution text check (resolution in ('confirmed_duplicate', 'linked_related', 'not_duplicate', 'pending')),
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_duplicates_submission on editorial.duplicate_candidates(submission_id);
create index idx_duplicates_incident on editorial.duplicate_candidates(incident_id);
