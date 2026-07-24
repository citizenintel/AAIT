import type { Polygon } from 'geojson';

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/** How confident the platform is in a given claim, broken down by dimension. */
export interface ConfidenceAnatomy {
  /** How many genuinely independent sources confirm this (0–100). */
  sourceIndependence: number;
  /** Geographic precision of the claim (0–100). */
  locationConfidence: number;
  /** Temporal precision of the claim (0–100). */
  timeConfidence: number;
  /** Has associated media been verified (0–100). */
  mediaAuthenticity: number;
  /** Event-type classification confidence (0–100). */
  classification: number;
  /** Do official sources confirm (0–100). */
  officialCorroboration: number;
  /** Penalty for contradicting evidence (0 to −100). */
  contradictionPenalty: number;
  /** Computed weighted aggregate score. */
  overall: number;
  /** Human-readable confidence level derived from overall + rules. */
  level: ConfidenceLevel;
}

/** Ordered from highest to lowest trust. */
export type ConfidenceLevel =
  | 'verified'
  | 'strongly_corroborated'
  | 'partially_corroborated'
  | 'unconfirmed'
  | 'disputed'
  | 'false_or_withdrawn'
  | 'insufficient_evidence';

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Full legal and operational metadata for a data source. */
export interface SourceAdapter {
  id: string;
  provider: string;
  licenseStatus: 'open' | 'free_restricted' | 'commercial' | 'unknown';
  permittedUse: string;
  commercialRestrictions: string[];
  rateLimit: { requests: number; window: string } | null;
  coverageArea: string;
  updateFrequency: string;
  lastSuccessfulRetrieval: Date | null;
  expectedLatency: number;
  observedLatency: number;
  fallbackSource: string | null;
  confidenceContribution: number;
  healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
  requiresLicense: boolean;
  licenseNotes: string;
}

/** A reference to a specific piece of source material backing a claim. */
export interface SourceReference {
  sourceAdapterId: string;
  url: string;
  title: string;
  publishedAt: Date;
  retrievedAt: Date;
  sourceType: 'official' | 'community' | 'national_media' | 'international_media' | 'industry' | 'social_media' | 'sensor' | 'academic';
  quotation: string;
  confidenceContribution: number;
}

/** Health-check result for a single source. */
export interface SourceHealthCheck {
  sourceId: string;
  isHealthy: boolean;
  latencyMs: number;
  dataAge: Date | null;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

/** A geographic point with uncertainty radius and H3 index. */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  radiusKm: number;
  placeName: string;
  province: string;
  country: string;
  h3Cell: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Every event type the platform tracks. */
export type EventType =
  | 'conflict'
  | 'protest'
  | 'crime'
  | 'natural_disaster'
  | 'infrastructure_failure'
  | 'political'
  | 'economic'
  | 'health'
  | 'environmental'
  | 'cyber'
  | 'maritime'
  | 'aviation'
  | 'energy'
  | 'market_event'
  | 'other';

/** Core intelligence event — the primary data entity. */
export interface IntelligenceEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  location: GeoLocation;
  h3Index: string;
  h3Indices: { res4: string; res6: string; res8: string };
  timestamp: Date;
  reportedAt: Date;
  updatedAt: Date;
  confidence: ConfidenceAnatomy;
  sources: SourceReference[];
  timeline: TimelineEntry[];
  relatedEvents: string[];
  relatedAssets: string[];
  tags: string[];
  status: 'active' | 'developing' | 'resolved' | 'archived';
  changeFromBaseline: ChangeMetrics | null;
}

/** How knowledge about an event evolved over time. */
export interface TimelineEntry {
  timestamp: Date;
  type: 'report' | 'update' | 'correction' | 'confirmation' | 'retraction' | 'escalation' | 'resolution';
  summary: string;
  source: string;
  previousBelief?: string;
  newBelief: string;
  confidenceChange: number;
  locationChange?: { previousRadiusKm: number; newRadiusKm: number };
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

/** Physical or logical infrastructure asset. */
export interface InfrastructureAsset {
  id: string;
  type: AssetType;
  name: string;
  location: GeoLocation;
  h3Index: string;
  status: 'operational' | 'degraded' | 'failed' | 'unknown';
  operator?: string;
  capacity?: string;
  dependencies: DependencyEdge[];
  dependents: DependencyEdge[];
  populationExposed: number;
  lastIncident?: Date;
  vulnerabilities: string[];
}

/** Every tracked infrastructure category. */
export type AssetType =
  | 'power_station'
  | 'substation'
  | 'transmission_line'
  | 'water_treatment'
  | 'water_pump'
  | 'reservoir'
  | 'cell_tower'
  | 'fiber_node'
  | 'submarine_cable'
  | 'hospital'
  | 'clinic'
  | 'emergency_service'
  | 'road'
  | 'bridge'
  | 'rail'
  | 'port'
  | 'airport'
  | 'pipeline'
  | 'refinery'
  | 'fuel_depot'
  | 'dam'
  | 'school'
  | 'government_building';

/** A directed dependency between two assets. */
export interface DependencyEdge {
  targetAssetId: string;
  dependencyType: 'power' | 'water' | 'connectivity' | 'transport' | 'fuel' | 'data';
  criticality: 'critical' | 'important' | 'convenience';
  redundancy: number;
  estimatedFailureImpact: string;
}

/** A node in the cascade consequence tree. */
export interface ConsequenceNode {
  assetId: string;
  asset: InfrastructureAsset;
  depth: number;
  impactType: string;
  populationExposed: number;
  estimatedRecoveryHours: number | null;
  alternativeRoutes: string[];
  children: ConsequenceNode[];
}

/** Full result from cascade analysis. */
export interface ConsequenceAnalysis {
  rootAsset: InfrastructureAsset;
  tree: ConsequenceNode;
  criticalServicesAffected: InfrastructureAsset[];
  totalPopulationExposed: number;
  alternativeRoutes: string[];
  dataGaps: string[];
  worstCase: string;
  bestCase: string;
}

/** One step in a simulated cascade timeline. */
export interface CascadeTimelineStep {
  hoursSinceFailure: number;
  newlyAffected: InfrastructureAsset[];
  cumulativePopulation: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/** Quantified change from baseline for an event or area. */
export interface ChangeMetrics {
  changeFromLastHour: number;
  changeFromYesterday: number;
  changeFromWeekBaseline: number;
  changeFromSeasonalBaseline: number;
  isFirstOccurrence: boolean;
  stoppedReporting: boolean;
  geographicSpread: number;
  accelerationRate: number;
  novelty: number;
}

// ---------------------------------------------------------------------------
// Mission lenses
// ---------------------------------------------------------------------------

/** An analytical mission that reshapes the entire interface. */
export interface MissionLens {
  id: string;
  name: string;
  description: string;
  icon: string;
  activeLayers: string[];
  activeCharts: string[];
  terminology: Record<string, string>;
  reportTemplate: string;
  aiPromptContext: string;
  relevantEventTypes: EventType[];
  relevantAssetTypes: AssetType[];
}

/** The four predefined mission lenses. */
export const MISSION_LENSES: MissionLens[] = [
  {
    id: 'rural-security',
    name: 'Rural Security',
    description: 'Farm attacks, rural crime, response times, telecom coverage, weather impacts, and community reports.',
    icon: 'shield',
    activeLayers: ['incidents', 'response-times', 'roads', 'telecom', 'weather', 'community'],
    activeCharts: ['incident-density', 'response-histogram', 'severity-trend'],
    terminology: { event: 'incident', asset: 'resource', area: 'ward' },
    reportTemplate: 'rural-security-brief',
    aiPromptContext: 'Focus on rural crime patterns, farm attack trends, emergency response coverage gaps, and community early-warning networks.',
    relevantEventTypes: ['conflict', 'crime', 'infrastructure_failure'],
    relevantAssetTypes: ['cell_tower', 'road', 'emergency_service', 'clinic', 'hospital'],
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'Power grid, water systems, roads, telecoms, hospitals, and dependency chains.',
    icon: 'factory',
    activeLayers: ['power', 'water', 'roads', 'telecoms', 'hospitals', 'dependencies'],
    activeCharts: ['asset-status', 'cascade-risk', 'recovery-timeline'],
    terminology: { event: 'disruption', asset: 'asset', area: 'service zone' },
    reportTemplate: 'infrastructure-brief',
    aiPromptContext: 'Focus on infrastructure failures, cascade risks, dependency chains, population exposure, and recovery timelines.',
    relevantEventTypes: ['infrastructure_failure', 'energy', 'natural_disaster'],
    relevantAssetTypes: ['power_station', 'substation', 'transmission_line', 'water_treatment', 'water_pump', 'reservoir', 'cell_tower', 'fiber_node', 'hospital', 'road', 'bridge'],
  },
  {
    id: 'civil-stability',
    name: 'Civil Stability',
    description: 'Protests, service delivery, political events, unemployment hotspots, and road disruptions.',
    icon: 'users',
    activeLayers: ['protests', 'services', 'political', 'unemployment', 'road-disruptions'],
    activeCharts: ['protest-frequency', 'service-delivery', 'stability-index'],
    terminology: { event: 'development', asset: 'service point', area: 'municipality' },
    reportTemplate: 'civil-stability-brief',
    aiPromptContext: 'Focus on civil unrest patterns, service delivery failures, political events, and stability indicators.',
    relevantEventTypes: ['protest', 'political', 'economic', 'crime'],
    relevantAssetTypes: ['government_building', 'school', 'hospital', 'road', 'rail'],
  },
  {
    id: 'maritime-trade',
    name: 'Maritime & Trade',
    description: 'Vessel tracking, port activity, chokepoints, trade corridors, and piracy zones.',
    icon: 'ship',
    activeLayers: ['vessels', 'ports', 'chokepoints', 'trade-routes', 'piracy-zones'],
    activeCharts: ['port-throughput', 'vessel-density', 'route-risk'],
    terminology: { event: 'incident', asset: 'facility', area: 'zone' },
    reportTemplate: 'maritime-trade-brief',
    aiPromptContext: 'Focus on maritime security, port operations, shipping lane disruptions, and trade flow impacts.',
    relevantEventTypes: ['maritime', 'economic', 'crime', 'environmental'],
    relevantAssetTypes: ['port', 'submarine_cable', 'pipeline', 'refinery', 'fuel_depot'],
  },
];

// ---------------------------------------------------------------------------
// Narrative divergence
// ---------------------------------------------------------------------------

/** How different source groups tell different stories about the same event. */
export interface NarrativeDivergence {
  eventId: string;
  sourceGroups: NarrativeGroup[];
  commonFacts: string[];
  exclusiveClaims: ExclusiveClaim[];
  terminologyDifferences: Record<string, Record<string, string>>;
  casualtyDiscrepancies?: Record<string, Record<string, number>>;
  correctedClaims: CorrectedClaim[];
  coordinatedWording?: string;
}

/** A group of sources with a shared perspective. */
export interface NarrativeGroup {
  type: 'official' | 'community' | 'national_media' | 'international_media' | 'industry' | 'social_media';
  label: string;
  emphasis: string;
  sources: string[];
}

/** A claim made by only one source group. */
export interface ExclusiveClaim {
  claim: string;
  sourceGroup: string;
  contradicted: boolean;
  verifiedLater: boolean;
}

/** A claim that was revised after initial reporting. */
export interface CorrectedClaim {
  original: string;
  corrected: string;
  correctedAt: Date;
  correctedBy: string;
}

// ---------------------------------------------------------------------------
// Attention scoring
// ---------------------------------------------------------------------------

/** Weighted attention score determining what surfaces to the user. */
export interface AttentionScore {
  entityId: string;
  entityType: 'event' | 'asset' | 'area';
  score: number;
  factors: {
    changeFromBaseline: number;
    accelerationRate: number;
    geographicSpread: number;
    reliability: number;
    populationExposure: number;
    infrastructureImportance: number;
    novelty: number;
    sourceConvergence: number;
    watchAreaRelevance: number;
  };
}

// ---------------------------------------------------------------------------
// Watch areas & alerts
// ---------------------------------------------------------------------------

/** A user-defined geographic area with alert thresholds. */
export interface WatchArea {
  id: string;
  name: string;
  geometry: Polygon;
  h3Cells: string[];
  alertThresholds: {
    instabilityIndex: number;
    eventCount: number;
    changeRate: number;
  };
}

/** A platform alert triggered by threshold, anomaly, or system event. */
export interface Alert {
  id: string;
  type: 'threshold' | 'anomaly' | 'breaking' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  eventId?: string;
  timestamp: Date;
  acknowledged: boolean;
  hapticPattern?: number[];
}

// ---------------------------------------------------------------------------
// AI director
// ---------------------------------------------------------------------------

/** An action the AI director can take on the interface. */
export interface AIAction {
  type:
    | 'setGeography'
    | 'setEventFilter'
    | 'setVerification'
    | 'calculateTravelTime'
    | 'compareTimePeriods'
    | 'displayLocations'
    | 'generateCharts'
    | 'openReportPreview';
  parameters: Record<string, unknown>;
  description: string;
  reversible: boolean;
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/** The three interface levels. */
export type InterfaceLevel = 'glance' | 'investigate' | 'brief';

/** Rendering capability tier, auto-detected or manually overridden. */
export type RenderingTier = 'essential' | 'enhanced' | 'cinematic';

/** Top-level application state shape. */
export interface AppState {
  interfaceLevel: InterfaceLevel;
  renderingTier: RenderingTier;
  activeLens: MissionLens | null;
  selectedEventId: string | null;
  selectedAssetId: string | null;
  timeRange: { start: Date; end: Date };
  watchAreas: WatchArea[];
  alerts: Alert[];
  dataFreshness: Record<string, Date>;
}
