export const MAX_PUBLIC_CONTENT_SLOTS = 6;

export type SlotKey = 'slot-1' | 'slot-2' | 'slot-3' | 'slot-4' | 'slot-5' | 'slot-6';

export type SlotMode = 'auto' | 'paid_ad' | 'infographic' | 'placeholder' | 'hidden';

export type ContentType = 'paid_ad' | 'placeholder' | 'infographic';

export type AspectRatio = '16:9' | '4:3' | '1:1' | 'fluid';

export type FitMode = 'cover' | 'contain' | 'fill';

export interface SlotDefinition {
  key: SlotKey;
  label: string;
  location: string;
  aspectRatio: AspectRatio;
  maxWidth: number;
  maxHeight: number;
  fitMode: FitMode;
}

export interface SlotAssignment {
  slotKey: SlotKey;
  assetId: string | null;
  campaignId: string | null;
  mode: SlotMode;
}

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

export interface SlotState {
  assignments: Record<SlotKey, SlotAssignment>;
  globalInfographicFallback: boolean;
  globalDisplayEnabled: boolean;
}

export type ResolvedContent =
  | { type: 'paid_ad'; campaignId: string; displayName: string; tagline: string; linkUrl: string; imageUrl: string; size: string; icon: string; bgColor: string; textColor: string; accentColor: string }
  | { type: 'infographic'; infographicType: string }
  | { type: 'placeholder'; src: string; alt: string }
  | { type: 'hidden' };
