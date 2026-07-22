-- ============================================================
-- 00013: Ingestion system (ingestion domain)
-- News feeds, data sources, import pipeline per §37–38
-- ============================================================

-- Data sources (RSS feeds, APIs, official datasets)
create table ingestion.data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  source_type text not null, -- 'rss', 'api', 'scraper', 'manual_upload', 'official_dataset'
  url text,
  publisher_id uuid references public.source_publishers(id),
  language text default 'en',

  -- Health tracking (§38)
  status text not null default 'active' check (status in ('active', 'delayed', 'stale', 'failing', 'disabled', 'legally_paused')),
  expected_interval_minutes int, -- how often we expect new data
  last_successful_at timestamptz,
  last_attempted_at timestamptz,
  failure_count int not null default 0,
  current_error text,
  terms_review_date date, -- when to re-review legal terms

  -- Config
  is_active boolean not null default true,
  config jsonb, -- source-specific configuration
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ingest jobs
create table ingestion.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references ingestion.data_sources(id),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  items_found int not null default 0,
  items_processed int not null default 0,
  items_failed int not null default 0,
  error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ingest_jobs_source on ingestion.ingest_jobs(data_source_id);
create index idx_ingest_jobs_status on ingestion.ingest_jobs(status);

-- Raw ingested items (before triage)
create table ingestion.raw_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references ingestion.ingest_jobs(id),
  data_source_id uuid not null references ingestion.data_sources(id),

  -- Content
  headline text,
  summary text, -- permitted summary only
  canonical_url text,
  publication_time timestamptz,
  update_time timestamptz,
  language text,
  raw_content jsonb, -- structured extraction

  -- Candidates
  geographic_candidates jsonb, -- [{province, municipality, confidence}]
  category_candidates jsonb, -- [{category_slug, confidence}]

  -- Processing
  status text not null default 'new' check (status in ('new', 'processed', 'linked', 'rejected', 'duplicate')),
  linked_incident_id uuid references public.incidents(id),
  linked_submission_id uuid references editorial.submissions(id),
  duplicate_of uuid references ingestion.raw_items(id),

  created_at timestamptz not null default now()
);

create index idx_raw_items_source on ingestion.raw_items(data_source_id);
create index idx_raw_items_status on ingestion.raw_items(status);
create index idx_raw_items_url on ingestion.raw_items(canonical_url);

-- Imported files (bulk import §31)
create table ingestion.imported_files (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_type text not null, -- 'csv', 'xlsx', 'json', 'geojson', 'kml', etc.
  storage_path text not null,
  uploaded_by uuid not null references public.profiles(id),
  status text not null default 'uploaded' check (status in ('uploaded', 'scanning', 'scanned', 'mapping', 'processing', 'completed', 'failed')),
  row_count int,
  rows_processed int not null default 0,
  rows_failed int not null default 0,
  field_mapping jsonb, -- saved field mapping template
  error_details jsonb,
  created_at timestamptz not null default now()
);

-- Import rows (individual rows from bulk import)
create table ingestion.import_rows (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references ingestion.imported_files(id) on delete cascade,
  row_number int not null,
  raw_data jsonb not null,
  mapped_data jsonb,
  status text not null default 'pending' check (status in ('pending', 'mapped', 'draft_created', 'duplicate', 'rejected', 'error')),
  submission_id uuid references editorial.submissions(id), -- created draft
  duplicate_candidate_id uuid,
  errors jsonb,
  created_at timestamptz not null default now()
);

create index idx_import_rows_file on ingestion.import_rows(file_id);
