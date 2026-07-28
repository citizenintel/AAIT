// ---------------------------------------------------------------------------
// Stable placement identifiers — §3 of the spec
// Never use display labels as database identifiers.
// ---------------------------------------------------------------------------

export const MAX_PUBLIC_PLACEMENTS = 4;

export type PlacementId =
  | 'LEFT_RAIL_FEATURED'
  | 'LEFT_RAIL_COMPACT'
  | 'RIGHT_RAIL_RECTANGLE'
  | 'BOTTOM_LEADERBOARD';

// Backward-compat alias — will be removed once all legacy references are gone
export type SlotKey = PlacementId;

// ---------------------------------------------------------------------------
// Status enums — §13
// ---------------------------------------------------------------------------

export type GlobalPublicMode = 'DISABLED' | 'ACTIVE';

export type PlacementMode = 'DISABLED' | 'MANUAL' | 'AUTO' | 'FALLBACK_ONLY';

export type CampaignStatus =
  | 'DRAFT' | 'NEEDS_CREATIVE' | 'READY' | 'SCHEDULED'
  | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED' | 'REJECTED';

export type CreativeStatus =
  | 'UPLOADED' | 'PROCESSING' | 'NEEDS_CROP' | 'READY'
  | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export type AssignmentStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

// ---------------------------------------------------------------------------
// Image fitting — §9
// ---------------------------------------------------------------------------

export type FitMode = 'cover' | 'contain' | 'smart_crop';

export type AspectRatio = '6:5' | '32:5' | '364:45' | 'fluid';

// ---------------------------------------------------------------------------
// Placement definition — the four structural slots (§3)
// ---------------------------------------------------------------------------

export interface PlacementDefinition {
  id: PlacementId;
  publicLabel: string;
  referenceWidth: number;
  referenceHeight: number;
  aspectRatio: AspectRatio;
  placementGroup: string | null;
  defaultFitMode: FitMode;
}

// Legacy alias
export type SlotDefinition = PlacementDefinition;

// ---------------------------------------------------------------------------
// Data model — §2: Sponsor → Campaign → Creative → Placement Assignment
// ---------------------------------------------------------------------------

export interface Sponsor {
  id: string;
  name: string;
  legalName?: string;
  status: 'active' | 'inactive';
  websiteUrl: string;
  disclosureName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  sponsorId: string;
  name: string;
  status: CampaignStatus;
  startAt: string | null;
  endAt: string | null;
  destinationUrl: string;
  ctaLabel: string;
  disclosureText: string;
  priority: number;
  deliveryWeight: number;
  trackingMode: 'basic' | 'viewability';
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Creative {
  id: string;
  campaignId: string;
  status: CreativeStatus;
  altText: string;
  fitMode: FitMode;
  focalX: number;
  focalY: number;
  backgroundColor: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeVariant {
  id: string;
  creativeId: string;
  placementFormat: string;
  fileUrl: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
  cropData?: { x: number; y: number; width: number; height: number };
  status: 'PROCESSING' | 'READY' | 'FAILED';
  createdAt: string;
}

export interface Assignment {
  id: string;
  campaignId: string;
  placementId: PlacementId;
  status: AssignmentStatus;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  createdBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Placement config (per-slot runtime state)
// ---------------------------------------------------------------------------

export interface PlacementConfig {
  id: PlacementId;
  mode: PlacementMode;
  isEnabled: boolean;
  fallbackEnabled: boolean;
}

// Legacy alias
export type SlotAssignment = {
  slotKey: PlacementId;
  assetId: string | null;
  campaignId: string | null;
  mode: SlotMode;
};

// ---------------------------------------------------------------------------
// Resolved public placement — what the frontend receives (§19-20)
// ---------------------------------------------------------------------------

export type ResolvedContent =
  | ResolvedSponsor
  | ResolvedFallback
  | ResolvedPlaceholder
  | { type: 'hidden' };

export interface ResolvedSponsor {
  type: 'sponsor';
  campaignId: string;
  disclosure: string;
  sponsorName: string;
  displayName: string;
  tagline: string;
  linkUrl: string;
  imageUrl: string;
  size: string;
  icon: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  cta: string;
  fitMode: FitMode;
  focalX: number;
  focalY: number;
}

export interface ResolvedFallback {
  type: 'infographic';
  infographicType: string;
}

export interface ResolvedPlaceholder {
  type: 'placeholder';
  src: string;
  alt: string;
}

// ---------------------------------------------------------------------------
// Content assets (media library) — §8
// ---------------------------------------------------------------------------

export type ContentType = 'placeholder' | 'infographic';

export interface ContentAsset {
  id: string;
  label: string;
  contentType: ContentType;
  src: string;
  alt: string;
  enabled: boolean;
  order: number;
  uploadedAt: string;
}

// ---------------------------------------------------------------------------
// Legacy store compat
// ---------------------------------------------------------------------------

export type SlotMode = 'auto' | 'paid_ad' | 'infographic' | 'placeholder' | 'hidden';

export interface SlotState {
  assignments: Record<PlacementId, SlotAssignment>;
  globalInfographicFallback: boolean;
  globalDisplayEnabled: boolean;
}

// Legacy constant alias
export const MAX_PUBLIC_CONTENT_SLOTS = MAX_PUBLIC_PLACEMENTS;
