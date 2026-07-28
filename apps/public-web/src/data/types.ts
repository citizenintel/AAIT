export type VerificationState =
  | 'v0_unverified'
  | 'v1_triage'
  | 'v2_plausible_uncorroborated'
  | 'v3_corroborated'
  | 'v4_primary_source_confirmed'
  | 'v5_editorially_verified';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type LocationTier =
  | 'l0_none'
  | 'l1_province'
  | 'l2_municipality'
  | 'l3_area'
  | 'l4_approximate_cell'
  | 'l5_exact_public';

export type ModuleKey = 'ait' | 'unrest' | 'bias' | 'infrastructure' | 'natural' | 'traffic';

export type AppRole =
  | 'public_viewer'
  | 'registered_contributor'
  | 'trusted_contributor'
  | 'news_ingestion_bot'
  | 'junior_editor'
  | 'senior_editor'
  | 'moderator'
  | 'identity_reviewer'
  | 'evidence_reviewer'
  | 'bias_analyst'
  | 'editorial_lead'
  | 'security_admin'
  | 'sponsor_admin'
  | 'platform_admin'
  | 'system_administrator'
  | 'superadmin';
