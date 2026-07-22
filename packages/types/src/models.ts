import type {
  VerificationState,
  LocationTier,
  IncidentSeverity,
  IncidentStatus,
  SubmissionStatus,
  BamClassification,
  BiasIndicatorType,
  SourceType,
  AttributionPreference,
  KnowledgeType,
  AppRole,
  EvidenceStatus,
  CapabilityStatus,
  SponsorSize,
} from './enums';

// ─── Accounts ────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string;
  attribution_preference: AttributionPreference;
  preferred_language: 'en' | 'af';
  organisation?: string;
  bio?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
}

// ─── Incidents ───────────────────────────────────────────

export interface Incident {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  verification_state: VerificationState;
  severity: IncidentSeverity;
  status: IncidentStatus;
  bam_classification: BamClassification;
  occurred_at?: string;
  occurred_at_precision: 'exact' | 'approximate' | 'date_only' | 'month_only' | 'unknown';
  occurred_end_at?: string;
  is_ongoing: boolean;
  confirmed_facts?: string;
  reported_unconfirmed?: string;
  what_remains_unknown?: string;
  police_case_number?: string;
  court_reference?: string;
  victim_count_confirmed?: number;
  victim_count_reported?: number;
  fatality_count_confirmed?: number;
  fatality_count_reported?: number;
  injury_count_confirmed?: number;
  methodology_version: string;
  taxonomy_version: string;
  published_at?: string;
  published_by?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface IncidentVersion {
  id: string;
  incident_id: string;
  version_number: number;
  changed_fields: Record<string, unknown>;
  previous_values: Record<string, unknown>;
  change_reason: string;
  changed_by: string;
  methodology_version: string;
  created_at: string;
}

export interface IncidentCategory {
  id: string;
  slug: string;
  parent_id?: string;
  label_en: string;
  label_af?: string;
  description_en?: string;
  description_af?: string;
  module: string;
  icon_key?: string;
  colour_key?: string;
  sort_order: number;
  is_active: boolean;
  requires_two_person_approval: boolean;
  default_location_tier: LocationTier;
}

// ─── Locations ───────────────────────────────────────────

export interface PublicLocation {
  id: string;
  incident_id: string;
  location_tier: LocationTier;
  province?: string;
  district?: string;
  municipality?: string;
  town?: string;
  police_station_area?: string;
  display_label?: string;
  property_type?: string;
  tier_approved_by?: string;
  tier_approved_at?: string;
  // GeoJSON geometry handled separately for map rendering
}

// ─── Sources ─────────────────────────────────────────────

export interface Source {
  id: string;
  publisher_id?: string;
  source_type: SourceType;
  title?: string;
  canonical_url?: string;
  publication_date?: string;
  update_date?: string;
  language: string;
  summary?: string;
  underlying_source_id?: string;
  is_original: boolean;
  ingestion_time: string;
}

export interface SourcePublisher {
  id: string;
  name: string;
  slug: string;
  url?: string;
  country: string;
  publisher_type?: string;
  ownership_group_id?: string;
  is_active: boolean;
}

export interface Corroboration {
  id: string;
  incident_id: string;
  source_id: string;
  facts_supported?: string[];
  facts_contradicted?: string[];
  is_independent: boolean;
  reviewer_id?: string;
  reviewed_at?: string;
}

// ─── Submissions ─────────────────────────────────────────

export interface Submission {
  id: string;
  contributor_id: string;
  status: SubmissionStatus;
  category_id: string;
  knowledge_type: KnowledgeType;
  attribution_preference: AttributionPreference;
  occurred_at?: string;
  occurred_at_precision: string;
  occurred_end_at?: string;
  is_ongoing: boolean;
  date_learned?: string;
  narrative?: string;
  police_case_number?: string;
  court_reference?: string;
  reported_motive_statements?: string;
  reported_motive_evidence?: string;
  declared_truthful: boolean;
  uncertainty_disclosed: boolean;
  evidence_unaltered: boolean;
  accepts_review: boolean;
  assigned_to?: string;
  linked_incident_id?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Evidence ────────────────────────────────────────────

export interface EvidenceItem {
  id: string;
  submission_id?: string;
  incident_id?: string;
  status: EvidenceStatus;
  original_filename?: string;
  mime_type?: string;
  file_size_bytes?: number;
  file_extension?: string;
  sha256_hash?: string;
  perceptual_hash?: string;
  has_gps: boolean;
  redaction_applied: boolean;
  approved_for_public: boolean;
  contributor_id?: string;
  description?: string;
  content_date?: string;
  created_at: string;
}

// ─── Bias Assessment ─────────────────────────────────────

export interface BiasAssessment {
  id: string;
  incident_id: string;
  classification: BamClassification;
  assessment_summary?: string;
  methodology_version: string;
  primary_reviewer_id?: string;
  primary_reviewed_at?: string;
  secondary_reviewer_id?: string;
  secondary_reviewed_at?: string;
  is_current: boolean;
}

export interface BiasIndicator {
  id: string;
  assessment_id: string;
  indicator_type: BiasIndicatorType;
  description: string;
  source_id?: string;
  evidence_item_id?: string;
  evidence_description?: string;
  assessed_by: string;
  assessment: string;
  is_confirmed?: boolean;
  targeted_characteristic?: string;
}

// ─── Feature Flags ───────────────────────────────────────

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  provider?: string;
  status: CapabilityStatus;
  quota_used?: number;
  quota_limit?: number;
  cost_threshold_cents?: number;
  fallback_provider?: string;
  health_status: 'healthy' | 'degraded' | 'failing';
  last_success_at?: string;
  config?: Record<string, unknown>;
  description?: string;
}

// ─── Sponsors ────────────────────────────────────────────

export interface SponsorCampaign {
  id: string;
  sponsor_id: string;
  name: string;
  size: SponsorSize;
  placement: string;
  status: string;
  starts_at?: string;
  ends_at?: string;
  display_name: string;
  tagline?: string;
  link_url?: string;
  logo_path?: string;
}
