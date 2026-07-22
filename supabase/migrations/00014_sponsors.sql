-- ============================================================
-- 00014: Sponsorship system (sponsor domain)
-- Max 4 active, 3 sizes, independently disableable per §40
-- ============================================================

-- Sponsors
create table sponsor.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_path text, -- path in sponsor-public bucket
  url text,
  description_en text,
  description_af text,
  contact_email text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campaigns
create table sponsor.campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsor.sponsors(id),
  name text not null,
  size sponsor.sponsor_size not null default 'standard',
  placement sponsor.sponsor_placement_location not null default 'footer',
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'active', 'paused', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,

  -- Content
  display_name text not null,
  tagline text,
  link_url text,
  logo_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campaigns_sponsor on sponsor.campaigns(sponsor_id);
create index idx_campaigns_status on sponsor.campaigns(status);

-- Conflict checks (§40.5)
create table sponsor.conflicts (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsor.sponsors(id),
  conflict_type text not null, -- 'investigation_subject', 'incident_connection', 'political_affiliation', 'source_under_review'
  description text not null,
  incident_id uuid references public.incidents(id),
  assessed_by uuid not null references public.profiles(id),
  resolution text,
  is_blocking boolean not null default true,
  created_at timestamptz not null default now()
);

-- Disclosures
create table sponsor.disclosures (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references sponsor.campaigns(id),
  disclosure_text text not null,
  created_at timestamptz not null default now()
);

-- Aggregate tracking only (§40.6)
create table sponsor.impression_aggregates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references sponsor.campaigns(id),
  date date not null,
  placement sponsor.sponsor_placement_location not null,
  impressions int not null default 0,
  outbound_clicks int not null default 0,
  unique(campaign_id, date, placement)
);

-- Backend enforcement: max 4 active sponsors
create or replace function sponsor.check_max_active_sponsors()
returns trigger
language plpgsql
security definer
set search_path = sponsor
as $$
declare
  active_count int;
begin
  if new.status = 'active' then
    select count(distinct c.sponsor_id)
    into active_count
    from sponsor.campaigns c
    where c.status = 'active'
      and c.id != new.id
      and (c.ends_at is null or c.ends_at > now());

    if active_count >= 4 then
      raise exception 'Maximum of 4 active sponsors reached';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_max_sponsors
  before insert or update on sponsor.campaigns
  for each row execute function sponsor.check_max_active_sponsors();
