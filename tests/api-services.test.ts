import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: {}, from: vi.fn(), storage: { from: vi.fn() }, schema: vi.fn() },
  isSupabaseConfigured: vi.fn(() => false),
  editorial: vi.fn(),
  evidence: vi.fn(),
  sponsor: vi.fn(),
  audit: vi.fn(),
}));

describe('API services fall back to mock data when Supabase is not configured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fetchIncidents returns mock data', async () => {
    const { fetchIncidents } = await import('@/lib/api/incidents');
    const data = await fetchIncidents();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('title');
    expect(data[0]).toHaveProperty('severity');
  });

  it('fetchIncidentById returns incident by id', async () => {
    const { fetchIncidents, fetchIncidentById } = await import('@/lib/api/incidents');
    const all = await fetchIncidents();
    const first = all[0]!;
    const found = await fetchIncidentById(first.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(first.id);
  });

  it('fetchIncidentById returns null for unknown id', async () => {
    const { fetchIncidentById } = await import('@/lib/api/incidents');
    const result = await fetchIncidentById('nonexistent-id');
    expect(result).toBeNull();
  });

  it('fetchSubmissions returns mock data', async () => {
    const { fetchSubmissions } = await import('@/lib/api/submissions');
    const data = await fetchSubmissions();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('status');
  });

  it('fetchUsers returns mock data', async () => {
    const { fetchUsers } = await import('@/lib/api/users');
    const data = await fetchUsers();
    expect(data.length).toBeGreaterThan(0);
  });

  it('fetchSponsors returns mock data', async () => {
    const { fetchSponsors } = await import('@/lib/api/sponsors');
    const data = await fetchSponsors();
    expect(data.length).toBeGreaterThan(0);
  });

  it('fetchFeatureFlags returns defaults', async () => {
    const { fetchFeatureFlags } = await import('@/lib/api/feature-flags');
    const flags = await fetchFeatureFlags();
    expect(flags.length).toBe(14);
    expect(flags[0]).toHaveProperty('key');
    expect(flags[0]).toHaveProperty('is_enabled');
  });

  it('isFeatureEnabled checks flag state', async () => {
    const { fetchFeatureFlags, isFeatureEnabled } = await import('@/lib/api/feature-flags');
    const flags = await fetchFeatureFlags();
    expect(isFeatureEnabled(flags, 'map_provider')).toBe(true);
    expect(isFeatureEnabled(flags, '3d_terrain')).toBe(false);
    expect(isFeatureEnabled(flags, 'nonexistent')).toBe(false);
  });

  it('fetchTiers returns mock data', async () => {
    const { fetchTiers } = await import('@/lib/api/subscriptions');
    const tiers = await fetchTiers();
    expect(tiers.length).toBeGreaterThan(0);
  });

  it('fetchNewsItems returns mock data', async () => {
    const { fetchNewsItems } = await import('@/lib/api/news-feeds');
    const items = await fetchNewsItems();
    expect(items.length).toBeGreaterThan(0);
  });

  it('fetchRssFeeds returns mock data', async () => {
    const { fetchRssFeeds } = await import('@/lib/api/news-feeds');
    const feeds = await fetchRssFeeds();
    expect(feeds.length).toBeGreaterThan(0);
  });
});

describe('Auth service', () => {
  it('demo sign-in with valid credentials returns user', async () => {
    const { signIn } = await import('@/lib/api/auth');
    const user = await signIn('admin@altafrikaner.com', 'demo');
    expect(user.id).toBe('demo-admin');
    expect(user.role).toBe('system_administrator');
  });

  it('demo sign-in with invalid password throws', async () => {
    const { signIn } = await import('@/lib/api/auth');
    await expect(signIn('admin@altafrikaner.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('demo sign-in with unknown email throws', async () => {
    const { signIn } = await import('@/lib/api/auth');
    await expect(signIn('unknown@example.com', 'demo')).rejects.toThrow('Invalid credentials');
  });

  it('createSubmission returns demo ID when not configured', async () => {
    const { createSubmission } = await import('@/lib/api/submissions');
    const id = await createSubmission({
      category_slug: 'ait',
      knowledge_type: 'witness',
      narrative: 'Test narrative',
      declared_truthful: true,
      uncertainty_disclosed: true,
      evidence_unaltered: true,
      accepts_review: true,
    });
    expect(id).toMatch(/^SUB-DEMO-/);
  });
});
