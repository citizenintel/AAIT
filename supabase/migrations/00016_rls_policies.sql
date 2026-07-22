-- ============================================================
-- 00016: Row-Level Security policies
-- Default deny, explicit grants per §46
-- ============================================================

-- ────────────────────────────────────────────────────────
-- PUBLIC SCHEMA — visible to authenticated and anon
-- ────────────────────────────────────────────────────────

-- Incident categories: public read
alter table public.incident_categories enable row level security;
create policy "Categories are publicly readable"
  on public.incident_categories for select
  using (is_active = true);

-- Published incidents: public read for published only
alter table public.incidents enable row level security;
create policy "Published incidents are publicly readable"
  on public.incidents for select
  using (is_published = true);

create policy "Editors can read all incidents"
  on public.incidents for select
  using (public.has_any_role(array['senior_editor', 'legal_reviewer', 'triage_moderator']::public.app_role[]));

create policy "Editors can insert incidents"
  on public.incidents for insert
  with check (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

create policy "Editors can update incidents"
  on public.incidents for update
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

-- Public locations: readable when incident is published
alter table public.public_locations enable row level security;
create policy "Public locations readable for published incidents"
  on public.public_locations for select
  using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and i.is_published = true
    )
  );

create policy "Editors can manage public locations"
  on public.public_locations for all
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

-- Profiles: users can read any profile, update own
alter table public.profiles enable row level security;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- User roles: only admins can manage, users can read own
alter table public.user_roles enable row level security;
create policy "Users can read own roles"
  on public.user_roles for select
  using (user_id = auth.uid());

create policy "Admins can manage roles"
  on public.user_roles for all
  using (public.has_any_role(array['system_administrator', 'security_administrator']::public.app_role[]));

-- Sources: public read
alter table public.sources enable row level security;
create policy "Sources are publicly readable"
  on public.sources for select using (true);

create policy "Source managers can manage sources"
  on public.sources for all
  using (public.has_any_role(array['source_manager', 'senior_editor']::public.app_role[]));

alter table public.source_publishers enable row level security;
create policy "Publishers are publicly readable"
  on public.source_publishers for select using (true);

alter table public.source_ownership_groups enable row level security;
create policy "Ownership groups are publicly readable"
  on public.source_ownership_groups for select using (true);

-- Corroborations: public read for published incidents
alter table public.corroborations enable row level security;
create policy "Corroborations readable for published incidents"
  on public.corroborations for select
  using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and i.is_published = true
    )
  );

-- Contradictions: public read for published incidents
alter table public.contradictions enable row level security;
create policy "Contradictions readable for published incidents"
  on public.contradictions for select
  using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and i.is_published = true
    )
  );

-- Bias assessments: public read for published incidents
alter table public.bias_assessments enable row level security;
create policy "Bias assessments readable for published incidents"
  on public.bias_assessments for select
  using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and i.is_published = true
    )
  );

create policy "Editors can manage bias assessments"
  on public.bias_assessments for all
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

alter table public.bias_indicators enable row level security;
create policy "Bias indicators readable for published incidents"
  on public.bias_indicators for select
  using (
    exists (
      select 1 from public.bias_assessments ba
      join public.incidents i on i.id = ba.incident_id
      where ba.id = assessment_id and i.is_published = true
    )
  );

alter table public.alternative_motive_assessments enable row level security;
create policy "Alt motives readable for published incidents"
  on public.alternative_motive_assessments for select
  using (
    exists (
      select 1 from public.bias_assessments ba
      join public.incidents i on i.id = ba.incident_id
      where ba.id = assessment_id and i.is_published = true
    )
  );

-- Public evidence derivatives: public read
alter table public.public_evidence enable row level security;
create policy "Public evidence readable for published incidents"
  on public.public_evidence for select
  using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and i.is_published = true
    )
  );

-- Incident versions: public read for published
alter table public.incident_versions enable row level security;
create policy "Version history readable for published incidents"
  on public.incident_versions for select
  using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and i.is_published = true
    )
  );

-- Feature flags: public read
alter table public.feature_flags enable row level security;
create policy "Feature flags are publicly readable"
  on public.feature_flags for select using (true);

create policy "Admins can manage feature flags"
  on public.feature_flags for all
  using (public.has_role('system_administrator'));

-- Notification preferences: own only
alter table public.notification_preferences enable row level security;
create policy "Users can manage own notifications"
  on public.notification_preferences for all
  using (user_id = auth.uid());

-- Contributor preferences: own only
alter table public.contributor_preferences enable row level security;
create policy "Users can manage own preferences"
  on public.contributor_preferences for all
  using (user_id = auth.uid());

-- SA provinces: public read
alter table public.sa_provinces enable row level security;
create policy "Provinces are publicly readable"
  on public.sa_provinces for select using (true);

-- Methodology versions: public read
alter table public.methodology_versions enable row level security;
create policy "Methodology versions are publicly readable"
  on public.methodology_versions for select using (true);

-- ────────────────────────────────────────────────────────
-- EDITORIAL SCHEMA — role-gated
-- ────────────────────────────────────────────────────────

-- Submissions: contributor sees own, editorial staff sees assigned/all
alter table editorial.submissions enable row level security;
create policy "Contributors can read own submissions"
  on editorial.submissions for select
  using (contributor_id = auth.uid());

create policy "Contributors can insert submissions"
  on editorial.submissions for insert
  with check (contributor_id = auth.uid());

create policy "Contributors can update own drafts"
  on editorial.submissions for update
  using (contributor_id = auth.uid() and status = 'draft');

create policy "Editorial staff can read submissions"
  on editorial.submissions for select
  using (public.has_any_role(array['triage_moderator', 'evidence_reviewer', 'senior_editor', 'legal_reviewer']::public.app_role[]));

create policy "Editorial staff can update submissions"
  on editorial.submissions for update
  using (public.has_any_role(array['triage_moderator', 'evidence_reviewer', 'senior_editor', 'legal_reviewer']::public.app_role[]));

-- Submission sub-tables follow parent access
alter table editorial.submission_versions enable row level security;
alter table editorial.submission_answers enable row level security;
alter table editorial.submission_locations enable row level security;
alter table editorial.submission_sources enable row level security;
alter table editorial.submission_persons enable row level security;
alter table editorial.submission_status_history enable row level security;

-- Private locations: editorial staff only
alter table editorial.private_locations enable row level security;
create policy "Editors can access private locations"
  on editorial.private_locations for select
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

-- Moderation reviews: editorial staff
alter table editorial.moderation_reviews enable row level security;
create policy "Editorial staff can manage reviews"
  on editorial.moderation_reviews for all
  using (public.has_any_role(array['triage_moderator', 'evidence_reviewer', 'senior_editor', 'legal_reviewer']::public.app_role[]));

-- Editorial decisions: editors
alter table editorial.editorial_decisions enable row level security;
create policy "Editors can manage decisions"
  on editorial.editorial_decisions for all
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

-- Corrections: public read (they're visible per §36), editors manage
alter table editorial.corrections enable row level security;
create policy "Published corrections are publicly readable"
  on editorial.corrections for select
  using (is_public = true);

create policy "Editors can manage corrections"
  on editorial.corrections for all
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

-- Disputes: public read, anyone can create, editors manage
alter table editorial.disputes enable row level security;
create policy "Disputes are publicly readable"
  on editorial.disputes for select using (true);

create policy "Authenticated users can create disputes"
  on editorial.disputes for insert
  with check (auth.uid() is not null);

create policy "Editors can manage disputes"
  on editorial.disputes for update
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

-- Retractions: public read
alter table editorial.retractions enable row level security;
create policy "Retractions are publicly readable"
  on editorial.retractions for select using (true);

-- Duplicate candidates: editorial staff
alter table editorial.duplicate_candidates enable row level security;
create policy "Editorial staff can manage duplicates"
  on editorial.duplicate_candidates for all
  using (public.has_any_role(array['triage_moderator', 'senior_editor']::public.app_role[]));

-- Approval requirements/actions: editors
alter table editorial.approval_requirements enable row level security;
create policy "Editors can manage approval requirements"
  on editorial.approval_requirements for all
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

alter table editorial.approval_actions enable row level security;
create policy "Editors can manage approval actions"
  on editorial.approval_actions for all
  using (public.has_any_role(array['senior_editor', 'legal_reviewer']::public.app_role[]));

-- Conflicts of interest: editorial staff
alter table editorial.conflicts_of_interest enable row level security;
create policy "Editorial staff can manage COIs"
  on editorial.conflicts_of_interest for all
  using (public.has_any_role(array['triage_moderator', 'evidence_reviewer', 'senior_editor', 'legal_reviewer']::public.app_role[]));

-- ────────────────────────────────────────────────────────
-- EVIDENCE SCHEMA — role-gated
-- ────────────────────────────────────────────────────────

alter table evidence.evidence_items enable row level security;
create policy "Evidence reviewers can access evidence"
  on evidence.evidence_items for all
  using (public.has_any_role(array['evidence_reviewer', 'senior_editor', 'legal_reviewer']::public.app_role[]));

create policy "Contributors can see own submission evidence"
  on evidence.evidence_items for select
  using (contributor_id = auth.uid());

alter table evidence.chain_events enable row level security;
create policy "Evidence reviewers can access chain events"
  on evidence.chain_events for all
  using (public.has_any_role(array['evidence_reviewer', 'senior_editor', 'legal_reviewer']::public.app_role[]));

alter table evidence.access_logs enable row level security;
create policy "Security admins can read evidence access logs"
  on evidence.access_logs for select
  using (public.has_role('security_administrator'));

-- ────────────────────────────────────────────────────────
-- IDENTITY VAULT — highly restricted
-- ────────────────────────────────────────────────────────

alter table identity_vault.verifications enable row level security;
create policy "Identity reviewers can access verifications"
  on identity_vault.verifications for all
  using (public.has_role('identity_reviewer'));

create policy "Users can see own verification status"
  on identity_vault.verifications for select
  using (user_id = auth.uid());

alter table identity_vault.documents enable row level security;
create policy "Identity reviewers can access documents"
  on identity_vault.documents for all
  using (public.has_role('identity_reviewer'));

alter table identity_vault.access_logs enable row level security;
create policy "Security admins can read identity access logs"
  on identity_vault.access_logs for select
  using (public.has_role('security_administrator'));

alter table identity_vault.retention_actions enable row level security;
create policy "Security admins can read retention actions"
  on identity_vault.retention_actions for select
  using (public.has_role('security_administrator'));

-- ────────────────────────────────────────────────────────
-- INGESTION — internal only
-- ────────────────────────────────────────────────────────

alter table ingestion.data_sources enable row level security;
create policy "Source managers can manage data sources"
  on ingestion.data_sources for all
  using (public.has_any_role(array['source_manager', 'system_administrator']::public.app_role[]));

alter table ingestion.ingest_jobs enable row level security;
create policy "Source managers can manage ingest jobs"
  on ingestion.ingest_jobs for all
  using (public.has_any_role(array['source_manager', 'system_administrator']::public.app_role[]));

alter table ingestion.raw_items enable row level security;
create policy "Editorial and source staff can access raw items"
  on ingestion.raw_items for all
  using (public.has_any_role(array['source_manager', 'triage_moderator', 'senior_editor']::public.app_role[]));

alter table ingestion.imported_files enable row level security;
create policy "Editorial staff can manage imports"
  on ingestion.imported_files for all
  using (public.has_any_role(array['source_manager', 'senior_editor']::public.app_role[]));

alter table ingestion.import_rows enable row level security;
create policy "Editorial staff can manage import rows"
  on ingestion.import_rows for all
  using (public.has_any_role(array['source_manager', 'senior_editor']::public.app_role[]));

-- ────────────────────────────────────────────────────────
-- SPONSOR — admin only
-- ────────────────────────────────────────────────────────

alter table sponsor.sponsors enable row level security;
create policy "Sponsor managers can manage sponsors"
  on sponsor.sponsors for all
  using (public.has_role('sponsor_manager'));

alter table sponsor.campaigns enable row level security;
-- Public can read active campaigns (for rendering)
create policy "Active campaigns are publicly readable"
  on sponsor.campaigns for select
  using (status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now()));

create policy "Sponsor managers can manage campaigns"
  on sponsor.campaigns for all
  using (public.has_role('sponsor_manager'));

alter table sponsor.conflicts enable row level security;
create policy "Sponsor managers can manage conflicts"
  on sponsor.conflicts for all
  using (public.has_role('sponsor_manager'));

alter table sponsor.disclosures enable row level security;
create policy "Disclosures are publicly readable"
  on sponsor.disclosures for select using (true);

alter table sponsor.impression_aggregates enable row level security;
create policy "Sponsor managers can manage impressions"
  on sponsor.impression_aggregates for all
  using (public.has_role('sponsor_manager'));

-- ────────────────────────────────────────────────────────
-- AUDIT — append-only, admin read
-- ────────────────────────────────────────────────────────

alter table audit.logs enable row level security;
create policy "Security admins can read audit logs"
  on audit.logs for select
  using (public.has_any_role(array['security_administrator', 'system_administrator']::public.app_role[]));

create policy "System can insert audit logs"
  on audit.logs for insert
  with check (true); -- insertable by any authenticated context (service role or edge function)
