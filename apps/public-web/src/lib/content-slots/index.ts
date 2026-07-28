export { MAX_PUBLIC_PLACEMENTS, MAX_PUBLIC_CONTENT_SLOTS } from './types';
export type {
  PlacementId, SlotKey,
  PlacementMode, CampaignStatus, CreativeStatus, AssignmentStatus, GlobalPublicMode,
  FitMode, AspectRatio, ContentType,
  PlacementDefinition, SlotDefinition,
  Sponsor, Campaign, Creative, CreativeVariant, Assignment,
  PlacementConfig, SlotAssignment,
  ResolvedContent, ResolvedSponsor, ResolvedFallback, ResolvedPlaceholder,
  ContentAsset, SlotState, SlotMode,
} from './types';
export {
  PLACEMENT_REGISTRY, SLOT_REGISTRY,
  ALL_PLACEMENT_IDS, ALL_SLOT_KEYS,
  getPlacementDefinition, getSlotDefinition,
  getAspectRatioCss,
} from './registry';
export { getAssets, saveAssets, getAssetsByType, getEnabledAssetsByType, getImageData, uploadAsset, removeAsset, toggleAsset, getStorageUsage, migrateFromLegacy } from './asset-library';
export { resolvePublicPlacement, resolveSlotContent } from './resolver';
export type { PlacementContext, ResolverInput } from './resolver';
export { TEST_CREATIVE_URIS, getTestCreativeUri, TEST_CREATIVE_SPECS } from './test-creatives';
export { seedTestData, clearTestData, isTestDataSeeded } from './seed';
export {
  loadStore, saveStore, clearSponsorStore, isStoreSeeded,
  migrateFromLegacy as migrateSponsorStore,
  getActiveCampaignRows,
  getSponsor, upsertSponsor, deleteSponsor,
  getCampaign, upsertCampaign, deleteCampaign,
  getCreative, getCreativesForCampaign, upsertCreative, deleteCreative,
  getVariantsForCreative, upsertVariant,
  getAssignmentsForPlacement, getAssignmentsForCampaign, upsertAssignment, deleteAssignment,
} from './sponsor-service';
export type { SponsorStore } from './sponsor-service';
export {
  generateVariant, generateAllVariants, toCreativeVariant, imageFromFile,
} from './creative-processor';
export type { VariantSpec, ProcessedVariant } from './creative-processor';
