-- ============================================================
-- 00007: Location system
-- Public and private location separation per §17
-- No public join path from approximate → precise
-- ============================================================

-- Public locations (what the map shows)
create table public.public_locations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  location_tier public.location_tier not null default 'l4_approximate_cell',

  -- Geometry (public-safe precision only)
  point public.geometry(Point, 4326), -- approximate or exact per tier
  area public.geometry(Polygon, 4326), -- area polygon for L2/L3/L4
  road_segment public.geometry(LineString, 4326),

  -- Administrative (always populated to permitted level)
  province text,
  district text,
  municipality text,
  town text,
  police_station_area text,

  -- Display
  display_label text, -- "Near Stellenbosch, Western Cape"
  property_type text, -- farm, smallholding, residential, commercial, road, etc.

  -- Approval
  tier_approved_by uuid references public.profiles(id),
  tier_approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_public_locations_incident on public.public_locations(incident_id);
create index idx_public_locations_point on public.public_locations using gist(point);
create index idx_public_locations_area on public.public_locations using gist(area);
create index idx_public_locations_province on public.public_locations(province);
create index idx_public_locations_municipality on public.public_locations(municipality);
create index idx_public_locations_tier on public.public_locations(location_tier);

-- Private locations (restricted access, never exposed through public API)
create table editorial.private_locations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  submission_id uuid, -- FK added in submissions migration

  -- Full precision
  precise_point public.geometry(Point, 4326),
  gps_accuracy_meters float,
  address text,
  property_name text,
  erf_number text,
  farm_name text,
  road_name text,
  road_km_marker text,

  -- Link to public version
  public_location_id uuid references public.public_locations(id),

  -- Access control
  sensitivity_reason text,
  access_restricted_to public.app_role[] default array['senior_editor', 'legal_reviewer']::public.app_role[],

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_private_locations_incident on editorial.private_locations(incident_id);
create index idx_private_locations_point on editorial.private_locations using gist(precise_point);

-- SA province reference
create table public.sa_provinces (
  code text primary key, -- 'WC', 'GP', 'KZN', etc.
  name_en text not null,
  name_af text not null,
  boundary public.geometry(MultiPolygon, 4326),
  centroid public.geometry(Point, 4326)
);

insert into public.sa_provinces (code, name_en, name_af) values
  ('EC', 'Eastern Cape', 'Oos-Kaap'),
  ('FS', 'Free State', 'Vrystaat'),
  ('GP', 'Gauteng', 'Gauteng'),
  ('KZN', 'KwaZulu-Natal', 'KwaZulu-Natal'),
  ('LP', 'Limpopo', 'Limpopo'),
  ('MP', 'Mpumalanga', 'Mpumalanga'),
  ('NC', 'Northern Cape', 'Noord-Kaap'),
  ('NW', 'North West', 'Noordwes'),
  ('WC', 'Western Cape', 'Wes-Kaap');
