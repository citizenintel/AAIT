-- ============================================================
-- 00002: Core enumerations
-- Central type definitions used across all domains
-- ============================================================

-- Roles (§33)
create type public.app_role as enum (
  'visitor',
  'registered_contributor',
  'verified_contributor',
  'researcher',
  'triage_moderator',
  'evidence_reviewer',
  'identity_reviewer',
  'senior_editor',
  'legal_reviewer',
  'source_manager',
  'sponsor_manager',
  'billing_administrator',
  'system_administrator',
  'security_administrator'
);

-- Verification state machine (§22)
create type public.verification_state as enum (
  'v0_unreviewed',
  'v1_triage',
  'v2_plausible_uncorroborated',
  'v3_corroborated',
  'v4_primary_source_confirmed',
  'v5_editorially_verified',
  'vx_disputed',
  'vr_retracted',
  'va_archived'
);

-- Location privacy tiers (§17)
create type public.location_tier as enum (
  'l0_no_public_location',
  'l1_province_only',
  'l2_municipality_only',
  'l3_town_or_area',
  'l4_approximate_cell',
  'l5_exact_public'
);

-- Incident severity
create type public.incident_severity as enum (
  'critical',
  'high',
  'medium',
  'low',
  'informational'
);

-- Incident status
create type public.incident_status as enum (
  'active',
  'developing',
  'monitoring',
  'resolved',
  'closed',
  'disputed',
  'retracted'
);

-- Submission status
create type editorial.submission_status as enum (
  'draft',
  'submitted',
  'triage',
  'under_review',
  'information_requested',
  'held',
  'rejected',
  'escalated',
  'linked_to_incident',
  'archived'
);

-- Bias Assessment Matrix classifications (§23)
create type public.bam_classification as enum (
  'not_assessed',
  'no_current_bias_indicators',
  'bias_indicators_reported',
  'suspected_bias_motivation',
  'corroborated_probable_bias',
  'officially_classified',
  'court_determined',
  'disputed',
  'retracted'
);

-- Bias indicator type (§23.1)
create type public.bias_indicator_type as enum (
  'direct',
  'target_selection',
  'contextual'
);

-- Evidence status
create type evidence.evidence_status as enum (
  'quarantined',
  'validating',
  'validation_failed',
  'original_stored',
  'redacting',
  'redacted',
  'public_derivative_created',
  'rejected'
);

-- Source type
create type public.source_type as enum (
  'primary_witness',
  'direct_participant',
  'official_document',
  'police_statement',
  'court_record',
  'government_notice',
  'news_original',
  'news_syndicated',
  'news_wire',
  'community_report',
  'organisation_statement',
  'research_dataset',
  'social_media',
  'anonymous_tip',
  'platform_investigation'
);

-- Knowledge type (how the contributor knows)
create type editorial.knowledge_type as enum (
  'personal_witness',
  'direct_account',
  'document_based',
  'news_based',
  'social_media_based',
  'hearsay',
  'unknown'
);

-- Attribution preference (§27)
create type public.attribution_preference as enum (
  'publicly_attributed',
  'publicly_anonymous',
  'confidential_source'
);

-- Sponsor mode (§40.1)
create type sponsor.sponsor_mode as enum (
  'disabled',
  'hidden',
  'active'
);

-- Sponsor size (§40.2)
create type sponsor.sponsor_size as enum (
  'compact',
  'standard',
  'featured'
);

-- Sponsor placement (§40.3)
create type sponsor.sponsor_placement_location as enum (
  'footer',
  'sidebar',
  'module_landing',
  'support_page'
);

-- Editorial action type
create type editorial.editorial_action as enum (
  'assign',
  'request_information',
  'hold',
  'reject',
  'escalate',
  'mark_duplicate',
  'link_related',
  'corroborate',
  'confirm_primary_source',
  'redact',
  'approve',
  'publish',
  'dispute',
  'correct',
  'retract',
  'archive'
);

-- Feature flag status
create type public.capability_status as enum (
  'active',
  'degraded',
  'disabled',
  'failing'
);

-- Audit event category
create type audit.event_category as enum (
  'auth',
  'submission',
  'incident',
  'evidence',
  'identity',
  'editorial',
  'sponsor',
  'system',
  'access'
);
