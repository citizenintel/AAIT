-- ============================================================
-- 00017: Storage buckets per §30.1
-- Separate buckets for evidence pipeline stages
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidence-quarantine', 'evidence-quarantine', false, 52428800, null),
  ('evidence-originals', 'evidence-originals', false, 52428800, null),
  ('evidence-redacted', 'evidence-redacted', false, 52428800, null),
  ('identity-vault', 'identity-vault', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf']),
  ('sponsor-originals', 'sponsor-originals', false, 5242880, array['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']),
  ('sponsor-public', 'sponsor-public', true, 2097152, array['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']),
  ('public-media', 'public-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);

-- RLS on private buckets

-- Evidence quarantine: only service role and evidence reviewers
create policy "Evidence quarantine upload"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence-quarantine'
    and auth.uid() is not null
  );

create policy "Evidence quarantine read"
  on storage.objects for select
  using (
    bucket_id = 'evidence-quarantine'
    and public.has_any_role(array['evidence_reviewer', 'senior_editor']::public.app_role[])
  );

-- Evidence originals: evidence reviewers and editors only
create policy "Evidence originals read"
  on storage.objects for select
  using (
    bucket_id = 'evidence-originals'
    and public.has_any_role(array['evidence_reviewer', 'senior_editor', 'legal_reviewer']::public.app_role[])
  );

-- Identity vault: identity reviewers only
create policy "Identity vault read"
  on storage.objects for select
  using (
    bucket_id = 'identity-vault'
    and public.has_role('identity_reviewer')
  );

-- Public media: readable by anyone
create policy "Public media readable"
  on storage.objects for select
  using (bucket_id = 'public-media');

-- Sponsor public: readable by anyone
create policy "Sponsor public readable"
  on storage.objects for select
  using (bucket_id = 'sponsor-public');
