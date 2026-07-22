-- ============================================================
-- 00009: Evidence system (evidence domain)
-- Chain-of-custody, hashing, redaction pipeline per §30
-- ============================================================

-- Evidence items
create table evidence.evidence_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references editorial.submissions(id),
  incident_id uuid references public.incidents(id),
  status evidence.evidence_status not null default 'quarantined',

  -- File metadata (not the file itself — files live in storage buckets)
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  file_extension text,

  -- Integrity
  sha256_hash text,
  perceptual_hash text, -- for images/video
  hash_computed_at timestamptz,

  -- Extracted metadata (EXIF, GPS, timestamps — stored privately)
  extracted_metadata jsonb,
  has_gps boolean not null default false,
  extracted_timestamp timestamptz,

  -- Storage paths (bucket references, not URLs)
  quarantine_path text,
  original_path text, -- in evidence-originals bucket
  redacted_path text, -- in evidence-redacted bucket
  public_derivative_path text, -- in public-media bucket

  -- Redaction
  redaction_applied boolean not null default false,
  redaction_details jsonb, -- what was redacted: faces, plates, coordinates, etc.
  redacted_by uuid references public.profiles(id),
  redacted_at timestamptz,

  -- Approval
  approved_for_public boolean not null default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,

  -- Provenance
  contributor_id uuid references public.profiles(id),
  description text,
  content_date timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_evidence_submission on evidence.evidence_items(submission_id);
create index idx_evidence_incident on evidence.evidence_items(incident_id);
create index idx_evidence_status on evidence.evidence_items(status);
create index idx_evidence_hash on evidence.evidence_items(sha256_hash);
create index idx_evidence_perceptual on evidence.evidence_items(perceptual_hash);

-- Chain-of-custody events (append-only)
create table evidence.chain_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence.evidence_items(id) on delete cascade,
  event_type text not null, -- 'uploaded', 'quarantined', 'scanned', 'validated', 'hashed', 'stored', 'metadata_extracted', 'redacted', 'derivative_created', 'approved', 'accessed', 'rejected'
  actor_id uuid references public.profiles(id),
  actor_role text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index idx_chain_events_evidence on evidence.chain_events(evidence_id);
create index idx_chain_events_type on evidence.chain_events(event_type);

-- Evidence access log (who viewed what and why)
create table evidence.access_logs (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence.evidence_items(id),
  accessor_id uuid not null references public.profiles(id),
  accessor_role public.app_role not null,
  access_type text not null, -- 'view_metadata', 'view_original', 'view_redacted', 'download'
  access_reason text not null,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index idx_evidence_access_evidence on evidence.access_logs(evidence_id);
create index idx_evidence_access_accessor on evidence.access_logs(accessor_id);

-- Public evidence derivatives (what the public can see)
create table public.public_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  evidence_item_id uuid not null references evidence.evidence_items(id),
  display_type text not null, -- 'image', 'video_thumbnail', 'document_excerpt', 'audio_transcript'
  public_path text not null, -- path in public-media bucket
  caption text,
  attribution text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_public_evidence_incident on public.public_evidence(incident_id);
