-- ============================================================
-- 00011: Bias Assessment Matrix (§23)
-- Human-review framework — NOT a score or probability
-- ============================================================

-- Bias assessments (one per incident, versioned)
create table public.bias_assessments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  classification public.bam_classification not null default 'not_assessed',
  assessment_summary text, -- public-facing explanation of basis and uncertainty
  methodology_version text not null default '1.0',

  -- Review
  primary_reviewer_id uuid references public.profiles(id),
  primary_reviewed_at timestamptz,
  secondary_reviewer_id uuid references public.profiles(id), -- required for high-risk
  secondary_reviewed_at timestamptz,

  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bias_assessments_incident on public.bias_assessments(incident_id);
create index idx_bias_assessments_classification on public.bias_assessments(classification);

-- Individual bias indicators
create table public.bias_indicators (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.bias_assessments(id) on delete cascade,
  indicator_type public.bias_indicator_type not null,
  description text not null, -- what the indicator is

  -- Evidence for this indicator
  source_id uuid references public.sources(id),
  evidence_item_id uuid references evidence.evidence_items(id),
  evidence_description text,

  -- Review
  assessed_by uuid not null references public.profiles(id),
  assessment text not null, -- reviewer's assessment of this indicator
  is_confirmed boolean, -- null = not yet assessed, true = confirmed, false = rejected

  -- Targeted characteristic (§6.4)
  targeted_characteristic text, -- what characteristic was targeted

  created_at timestamptz not null default now()
);

create index idx_bias_indicators_assessment on public.bias_indicators(assessment_id);

-- Alternative motive assessments (§23.1)
create table public.alternative_motive_assessments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.bias_assessments(id) on delete cascade,
  motive_type text not null, -- 'robbery', 'personal_dispute', 'domestic', 'labour', 'organised_crime', 'land_dispute', 'financial', 'revenge', 'unknown'
  evidence_description text,
  source_id uuid references public.sources(id),
  likelihood text check (likelihood in ('strong', 'moderate', 'weak', 'excluded')),
  assessed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_alt_motives_assessment on public.alternative_motive_assessments(assessment_id);

-- Classification history (track changes)
create table public.bias_classification_history (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.bias_assessments(id),
  previous_classification public.bam_classification,
  new_classification public.bam_classification not null,
  reason text not null,
  changed_by uuid not null references public.profiles(id),
  methodology_version text not null,
  created_at timestamptz not null default now()
);
