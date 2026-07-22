-- ============================================================
-- 00001: Domain schemas and extensions
-- Eight separated domains per V2 spec §19
-- ============================================================

-- Extensions
create extension if not exists "postgis" schema public;
create extension if not exists "pg_trgm" schema public;
create extension if not exists "pgcrypto" schema public;
create extension if not exists "uuid-ossp" schema public;

-- Domain schemas
create schema if not exists editorial;
create schema if not exists evidence;
create schema if not exists identity_vault;
create schema if not exists ingestion;
create schema if not exists analytics;
create schema if not exists sponsor;
create schema if not exists audit;

comment on schema editorial is 'Submissions, reviews, editorial decisions — role-gated';
comment on schema evidence is 'Evidence metadata, hashes, chain-of-custody — role-gated';
comment on schema identity_vault is 'Contributor identity verification — restricted access';
comment on schema ingestion is 'Raw feed items, processing jobs — internal only';
comment on schema analytics is 'Aggregated, de-identified measures — public read';
comment on schema sponsor is 'Sponsorship campaigns, billing, disclosures — admin only';
comment on schema audit is 'Append-only access and change records — admin read only';
