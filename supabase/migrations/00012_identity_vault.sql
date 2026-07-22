-- ============================================================
-- 00012: Identity vault (identity_vault domain)
-- Completely separated from profile/contributor system
-- Envelope encryption, access logging, retention per §28
-- ============================================================

-- Identity verifications
create table identity_vault.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  verification_method text not null, -- 'verified_email', 'passkey', 'verified_mobile', 'org_reference', 'live_call', 'police_reference', 'manual_document', 'external_provider'
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'verified', 'failed', 'expired', 'revoked')),
  result_summary text, -- verification result, NOT the raw document
  reviewer_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  provider_reference text, -- external provider reference ID
  expires_at timestamptz,
  retention_until timestamptz, -- when to auto-delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_verifications_user on identity_vault.verifications(user_id);
create index idx_verifications_status on identity_vault.verifications(status);

-- Identity documents (raw docs — avoid storing where possible)
create table identity_vault.documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references identity_vault.verifications(id) on delete cascade,
  document_type text not null, -- 'id_document', 'passport', 'drivers_licence', 'other'
  storage_path text not null, -- path in identity-vault bucket (encrypted)
  encryption_key_id text not null, -- reference to encryption key, NOT the key itself

  -- Consent
  consent_given boolean not null default false,
  consent_purpose text not null,
  consent_given_at timestamptz,

  -- Retention
  retention_until timestamptz not null,
  auto_delete_scheduled boolean not null default true,
  deleted_at timestamptz,
  deleted_by text, -- 'system_retention', 'user_request', 'admin_action'

  created_at timestamptz not null default now()
);

-- Identity access log (every view logged)
create table identity_vault.access_logs (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid references identity_vault.verifications(id),
  document_id uuid references identity_vault.documents(id),
  accessor_id uuid not null references public.profiles(id),
  accessor_role public.app_role not null,
  access_type text not null, -- 'view_result', 'view_document', 'review', 'audit'
  access_reason text not null,
  ip_address inet,
  mfa_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_identity_access_verification on identity_vault.access_logs(verification_id);
create index idx_identity_access_accessor on identity_vault.access_logs(accessor_id);

-- Retention actions
create table identity_vault.retention_actions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references identity_vault.documents(id),
  verification_id uuid references identity_vault.verifications(id),
  action_type text not null, -- 'auto_deleted', 'user_requested_deletion', 'admin_deleted', 'retention_extended', 'legal_hold'
  reason text not null,
  performed_by text not null, -- user_id or 'system'
  created_at timestamptz not null default now()
);
