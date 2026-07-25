export { signIn, signUp, signOut, getSession, onAuthStateChange } from './auth';
export type { AppUser } from './auth';

export { fetchIncidents, fetchIncidentById, createIncident, updateIncident } from './incidents';
export type { IncidentRow } from './incidents';

export { fetchSubmissions, fetchSubmissionById, createSubmission, updateSubmissionStatus, summariseWithAI } from './submissions';
export type { SubmissionRow } from './submissions';

export { fetchUsers, updateUserRole, deactivateUser } from './users';
export type { UserRow } from './users';

export { fetchSponsors, fetchActiveCampaigns, createSponsor, updateCampaignStatus } from './sponsors';
export type { SponsorRow, CampaignRow } from './sponsors';

export { uploadEvidence, fetchEvidenceForSubmission, fetchEvidenceForIncident, getPublicUrl } from './evidence';
export type { EvidenceRow } from './evidence';

export { fetchFeatureFlags, toggleFeatureFlag, isFeatureEnabled } from './feature-flags';
export type { FeatureFlagRow } from './feature-flags';

export { fetchNewsItems, fetchRssFeeds, updateRssFeed, createRssFeed, deleteRssFeed } from './news-feeds';

export { fetchTiers, fetchSubscribers, updateTier, cancelSubscription } from './subscriptions';

export { fetchEvents, fetchEventById } from './events';

export { fetchAssets, fetchAssetById } from './assets';
