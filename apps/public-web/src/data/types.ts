export type VerificationState =
  | 'v0_unverified'
  | 'v1_triage'
  | 'v2_plausible_uncorroborated'
  | 'v3_corroborated'
  | 'v4_primary_source_confirmed'
  | 'v5_editorially_verified';

/**
 * `unassessed` is NOT a severity level — it means no severity has been
 * established. It exists so an importer that cannot evidence a severity can say
 * so, instead of defaulting to 'medium' (an assertion the source never made).
 */
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational' | 'unassessed';

export type LocationTier =
  | 'l0_none'
  | 'l1_province'
  | 'l2_municipality'
  | 'l3_area'
  | 'l4_approximate_cell'
  | 'l5_exact_public';

/**
 * `unclassified` is NOT a module — it means no module could be evidenced from
 * the record. It exists so the importer can say "unknown" instead of defaulting
 * every keyword-less record into 'ait' (Farm & Rural).
 */
export type ModuleKey = 'ait' | 'unrest' | 'bias' | 'infrastructure' | 'natural' | 'traffic' | 'unclassified';

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
