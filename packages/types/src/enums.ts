export const VerificationState = {
  V0_UNREVIEWED: 'v0_unreviewed',
  V1_TRIAGE: 'v1_triage',
  V2_PLAUSIBLE_UNCORROBORATED: 'v2_plausible_uncorroborated',
  V3_CORROBORATED: 'v3_corroborated',
  V4_PRIMARY_SOURCE_CONFIRMED: 'v4_primary_source_confirmed',
  V5_EDITORIALLY_VERIFIED: 'v5_editorially_verified',
  VX_DISPUTED: 'vx_disputed',
  VR_RETRACTED: 'vr_retracted',
  VA_ARCHIVED: 'va_archived',
} as const;
export type VerificationState = (typeof VerificationState)[keyof typeof VerificationState];

export const LocationTier = {
  L0_NO_PUBLIC_LOCATION: 'l0_no_public_location',
  L1_PROVINCE_ONLY: 'l1_province_only',
  L2_MUNICIPALITY_ONLY: 'l2_municipality_only',
  L3_TOWN_OR_AREA: 'l3_town_or_area',
  L4_APPROXIMATE_CELL: 'l4_approximate_cell',
  L5_EXACT_PUBLIC: 'l5_exact_public',
} as const;
export type LocationTier = (typeof LocationTier)[keyof typeof LocationTier];

export const IncidentSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFORMATIONAL: 'informational',
} as const;
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

export const IncidentStatus = {
  ACTIVE: 'active',
  DEVELOPING: 'developing',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  DISPUTED: 'disputed',
  RETRACTED: 'retracted',
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const SubmissionStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  TRIAGE: 'triage',
  UNDER_REVIEW: 'under_review',
  INFORMATION_REQUESTED: 'information_requested',
  HELD: 'held',
  REJECTED: 'rejected',
  ESCALATED: 'escalated',
  LINKED_TO_INCIDENT: 'linked_to_incident',
  ARCHIVED: 'archived',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const BamClassification = {
  NOT_ASSESSED: 'not_assessed',
  NO_CURRENT_BIAS_INDICATORS: 'no_current_bias_indicators',
  BIAS_INDICATORS_REPORTED: 'bias_indicators_reported',
  SUSPECTED_BIAS_MOTIVATION: 'suspected_bias_motivation',
  CORROBORATED_PROBABLE_BIAS: 'corroborated_probable_bias',
  OFFICIALLY_CLASSIFIED: 'officially_classified',
  COURT_DETERMINED: 'court_determined',
  DISPUTED: 'disputed',
  RETRACTED: 'retracted',
} as const;
export type BamClassification = (typeof BamClassification)[keyof typeof BamClassification];

export const BiasIndicatorType = {
  DIRECT: 'direct',
  TARGET_SELECTION: 'target_selection',
  CONTEXTUAL: 'contextual',
} as const;
export type BiasIndicatorType = (typeof BiasIndicatorType)[keyof typeof BiasIndicatorType];

export const SourceType = {
  PRIMARY_WITNESS: 'primary_witness',
  DIRECT_PARTICIPANT: 'direct_participant',
  OFFICIAL_DOCUMENT: 'official_document',
  POLICE_STATEMENT: 'police_statement',
  COURT_RECORD: 'court_record',
  GOVERNMENT_NOTICE: 'government_notice',
  NEWS_ORIGINAL: 'news_original',
  NEWS_SYNDICATED: 'news_syndicated',
  NEWS_WIRE: 'news_wire',
  COMMUNITY_REPORT: 'community_report',
  ORGANISATION_STATEMENT: 'organisation_statement',
  RESEARCH_DATASET: 'research_dataset',
  SOCIAL_MEDIA: 'social_media',
  ANONYMOUS_TIP: 'anonymous_tip',
  PLATFORM_INVESTIGATION: 'platform_investigation',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const AttributionPreference = {
  PUBLICLY_ATTRIBUTED: 'publicly_attributed',
  PUBLICLY_ANONYMOUS: 'publicly_anonymous',
  CONFIDENTIAL_SOURCE: 'confidential_source',
} as const;
export type AttributionPreference = (typeof AttributionPreference)[keyof typeof AttributionPreference];

export const KnowledgeType = {
  PERSONAL_WITNESS: 'personal_witness',
  DIRECT_ACCOUNT: 'direct_account',
  DOCUMENT_BASED: 'document_based',
  NEWS_BASED: 'news_based',
  SOCIAL_MEDIA_BASED: 'social_media_based',
  HEARSAY: 'hearsay',
  UNKNOWN: 'unknown',
} as const;
export type KnowledgeType = (typeof KnowledgeType)[keyof typeof KnowledgeType];

export const AppRole = {
  VISITOR: 'visitor',
  REGISTERED_CONTRIBUTOR: 'registered_contributor',
  VERIFIED_CONTRIBUTOR: 'verified_contributor',
  RESEARCHER: 'researcher',
  TRIAGE_MODERATOR: 'triage_moderator',
  EVIDENCE_REVIEWER: 'evidence_reviewer',
  IDENTITY_REVIEWER: 'identity_reviewer',
  SENIOR_EDITOR: 'senior_editor',
  LEGAL_REVIEWER: 'legal_reviewer',
  SOURCE_MANAGER: 'source_manager',
  SPONSOR_MANAGER: 'sponsor_manager',
  BILLING_ADMINISTRATOR: 'billing_administrator',
  SYSTEM_ADMINISTRATOR: 'system_administrator',
  SECURITY_ADMINISTRATOR: 'security_administrator',
} as const;
export type AppRole = (typeof AppRole)[keyof typeof AppRole];

export const EvidenceStatus = {
  QUARANTINED: 'quarantined',
  VALIDATING: 'validating',
  VALIDATION_FAILED: 'validation_failed',
  ORIGINAL_STORED: 'original_stored',
  REDACTING: 'redacting',
  REDACTED: 'redacted',
  PUBLIC_DERIVATIVE_CREATED: 'public_derivative_created',
  REJECTED: 'rejected',
} as const;
export type EvidenceStatus = (typeof EvidenceStatus)[keyof typeof EvidenceStatus];

export const CapabilityStatus = {
  ACTIVE: 'active',
  DEGRADED: 'degraded',
  DISABLED: 'disabled',
  FAILING: 'failing',
} as const;
export type CapabilityStatus = (typeof CapabilityStatus)[keyof typeof CapabilityStatus];

export const SponsorMode = {
  DISABLED: 'disabled',
  HIDDEN: 'hidden',
  ACTIVE: 'active',
} as const;
export type SponsorMode = (typeof SponsorMode)[keyof typeof SponsorMode];

export const SponsorSize = {
  COMPACT: 'compact',
  STANDARD: 'standard',
  FEATURED: 'featured',
} as const;
export type SponsorSize = (typeof SponsorSize)[keyof typeof SponsorSize];
