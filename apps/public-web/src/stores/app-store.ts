import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { openDB, type IDBPDatabase } from 'idb';

enableMapSet();
import type {
  InterfaceLevel,
  RenderingTier,
  MissionLens,
  IntelligenceEvent,
  InfrastructureAsset,
  WatchArea,
  Alert,
  SourceHealthCheck,
} from '@/types/ontology';
import type { ModuleKey, IncidentSeverity, AppRole } from '@/data/types';

// ---------------------------------------------------------------------------
// IndexedDB persistence
// ---------------------------------------------------------------------------

const DB_NAME = 'inteltwin';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events');
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets');
        if (!db.objectStoreNames.contains('watchAreas')) db.createObjectStore('watchAreas');
      },
    });
  }
  return dbPromise;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function debouncePersist(storeName: string, data: unknown) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const db = await getDb();
      const tx = db.transaction(storeName, 'readwrite');
      await tx.store.put(data, 'data');
      await tx.done;
    } catch {
      // IndexedDB may be unavailable in private browsing
    }
  }, 1000);
}

async function hydrateStore<T>(storeName: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    return await db.get(storeName, 'data');
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Legacy types (re-exported for old page imports)
// ---------------------------------------------------------------------------

export type WidgetId = 'stats_bar' | 'severity_pie' | 'module_pie' | 'province_bar' | 'trend_line' | 'news_ticker' | 'casualties_card' | 'verification_pie';

export interface WidgetConfig {
  id: WidgetId;
  enabled: boolean;
  position: 'top' | 'right' | 'bottom';
  order: number;
}

export interface TickerConfig {
  enabled: boolean;
  mode: 'custom' | 'rss';
  customText: string;
  rssFeedId: string | null;
  direction: 'ltr' | 'rtl';
  speedSeconds: number;
  tone: 'normal' | 'alert';
  fontBold: boolean;
  fontColor: 'white' | 'green' | 'yellow' | 'red';
}

export interface ModPermissions {
  dashboard: boolean;
  ticker: boolean;
  incidents: boolean;
  submissions: boolean;
  reports: boolean;
  feeds: boolean;
  import: boolean;
  exportPrint: boolean;
}

const DEFAULT_MOD_PERMISSIONS: ModPermissions = {
  dashboard: true,
  ticker: true,
  incidents: false,
  submissions: false,
  reports: false,
  feeds: false,
  import: false,
  exportPrint: false,
};

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  avatarUrl?: string;
}

interface FilterState {
  modules: Record<ModuleKey, boolean>;
  categories: Record<string, boolean>;
  severities: Record<IncidentSeverity, boolean>;
  showSynthetic: boolean;
  searchQuery: string;
  dateRange: { from: string | null; to: string | null };
  province: string | null;
}

interface UIState {
  sidebarOpen: boolean;
  activePanel: 'layers' | 'details' | 'report' | 'search' | null;
  selectedIncidentId: string | null;
  mapStyle: 'standard' | 'light' | 'terrain' | 'satellite';
  measureActive: boolean;
  mobileMenuOpen: boolean;
}

interface WidgetState {
  widgets: WidgetConfig[];
  panelOpen: boolean;
  newsFeedEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface AppStore {
  // --- Interface slice ---
  interfaceLevel: InterfaceLevel;
  renderingTier: RenderingTier;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  setInterfaceLevel: (level: InterfaceLevel) => void;
  setRenderingTier: (tier: RenderingTier) => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;

  // --- Lens slice ---
  activeLens: MissionLens | null;
  setActiveLens: (lens: MissionLens | null) => void;

  // --- Events slice ---
  events: Map<string, IntelligenceEvent>;
  selectedEventId: string | null;
  addEvents: (events: IntelligenceEvent[]) => void;
  updateEvent: (id: string, partial: Partial<IntelligenceEvent>) => void;
  selectEvent: (id: string | null) => void;
  getEventsByH3Cell: (h3Cell: string) => IntelligenceEvent[];
  getEventsByType: (type: string) => IntelligenceEvent[];
  getActiveEvents: () => IntelligenceEvent[];

  // --- Assets slice ---
  assets: Map<string, InfrastructureAsset>;
  selectedAssetId: string | null;
  addAssets: (assets: InfrastructureAsset[]) => void;
  selectAsset: (id: string | null) => void;

  // --- Time slice ---
  currentTime: Date;
  timeRange: { start: Date; end: Date };
  isPlaying: boolean;
  playbackSpeed: number;
  setCurrentTime: (time: Date) => void;
  setTimeRange: (start: Date, end: Date) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;

  // --- Watch areas slice ---
  watchAreas: WatchArea[];
  addWatchArea: (area: WatchArea) => void;
  removeWatchArea: (id: string) => void;
  updateWatchArea: (id: string, partial: Partial<WatchArea>) => void;

  // --- Alerts slice ---
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;
  unacknowledgedCount: () => number;

  // --- Source health slice ---
  sourceHealth: Map<string, SourceHealthCheck>;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  updateSourceHealth: (checks: SourceHealthCheck[]) => void;

  // --- Auth slice (legacy) ---
  auth: { isAuthenticated: boolean; user: AuthUser | null };
  login: (user: AuthUser | null) => void;
  logout: () => void;

  // --- Filters slice (legacy) ---
  filters: FilterState;
  setModuleFilter: (module: ModuleKey, enabled: boolean) => void;
  setCategoryFilter: (category: string, enabled: boolean) => void;
  setSeverityFilter: (severity: IncidentSeverity, enabled: boolean) => void;
  setShowSynthetic: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setProvince: (province: string | null) => void;
  resetFilters: () => void;

  // --- UI slice (legacy) ---
  ui: UIState;
  setActivePanel: (panel: UIState['activePanel']) => void;
  setSelectedIncident: (id: string | null) => void;
  setMapStyle: (style: UIState['mapStyle']) => void;
  setMeasureActive: (active: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;

  // --- Widget slice (legacy) ---
  widgetState: WidgetState;
  toggleWidget: (id: WidgetId) => void;
  setWidgetPosition: (id: WidgetId, position: WidgetConfig['position']) => void;
  reorderWidget: (id: WidgetId, direction: 'up' | 'down') => void;
  setWidgetPanelOpen: (open: boolean) => void;
  setNewsFeedEnabled: (enabled: boolean) => void;

  // --- Ticker slice (legacy) ---
  ticker: TickerConfig;
  updateTicker: (patch: Partial<TickerConfig>) => void;

  // --- Sponsors (legacy) ---
  sponsorsEnabled: boolean;
  setSponsorsEnabled: (enabled: boolean) => void;

  // --- Dismissed alerts (legacy) ---
  dismissedAlertIds: Record<string, true>;
  dismissAlert: (id: string) => void;
  dismissAllAlerts: (ids: string[]) => void;
  clearDismissedAlerts: () => void;

  // --- Moderator permissions ---
  modPermissions: Record<string, ModPermissions>;
  modEnabled: Record<string, boolean>;
  setModPermission: (email: string, key: keyof ModPermissions, value: boolean) => void;
  setModEnabled: (email: string, enabled: boolean) => void;
  addModerator: (email: string) => void;
  removeModerator: (email: string) => void;

  // --- Feed freshness ---
  feedLastRefresh: Record<string, number>;
  markFeedRefreshed: (feedId: string) => void;
  cleanStaleFeeds: () => string[];

  // --- Hydration ---
  hydrate: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: FilterState = {
  modules: { ait: true, unrest: true, bias: true, infrastructure: true, natural: true, traffic: true },
  categories: {},
  severities: { critical: true, high: true, medium: true, low: true, informational: true },
  showSynthetic: true,
  searchQuery: '',
  dateRange: { from: null, to: null },
  province: null,
};

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats_bar', enabled: true, position: 'right', order: 0 },
  { id: 'severity_pie', enabled: true, position: 'right', order: 0 },
  { id: 'module_pie', enabled: true, position: 'right', order: 1 },
  { id: 'province_bar', enabled: true, position: 'right', order: 2 },
  { id: 'trend_line', enabled: true, position: 'right', order: 3 },
  { id: 'news_ticker', enabled: true, position: 'bottom', order: 0 },
  { id: 'casualties_card', enabled: true, position: 'right', order: 4 },
  { id: 'verification_pie', enabled: true, position: 'right', order: 5 },
];

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    // --- Interface ---
    interfaceLevel: 'glance',
    renderingTier: 'enhanced',
    sidebarOpen: false,
    commandPaletteOpen: false,
    setInterfaceLevel: (level) => set((s) => { s.interfaceLevel = level; }),
    setRenderingTier: (tier) => set((s) => { s.renderingTier = tier; }),
    setSidebarOpen: (open) => set((s) => {
      s.sidebarOpen = open;
      s.ui.sidebarOpen = open;
    }),
    setCommandPaletteOpen: (open) => set((s) => { s.commandPaletteOpen = open; }),

    // --- Lens ---
    activeLens: null,
    setActiveLens: (lens) => set((s) => { s.activeLens = lens; }),

    // --- Events ---
    events: new Map(),
    selectedEventId: null,
    addEvents: (events) => set((s) => {
      for (const e of events) s.events.set(e.id, e);
      debouncePersist('events', Array.from(s.events.values()));
    }),
    updateEvent: (id, partial) => set((s) => {
      const existing = s.events.get(id);
      if (existing) {
        s.events.set(id, { ...existing, ...partial });
        debouncePersist('events', Array.from(s.events.values()));
      }
    }),
    selectEvent: (id) => set((s) => { s.selectedEventId = id; }),
    getEventsByH3Cell: (h3Cell) => {
      const result: IntelligenceEvent[] = [];
      for (const e of get().events.values()) {
        if (e.h3Index === h3Cell) result.push(e);
      }
      return result;
    },
    getEventsByType: (type) => {
      const result: IntelligenceEvent[] = [];
      for (const e of get().events.values()) {
        if (e.type === type) result.push(e);
      }
      return result;
    },
    getActiveEvents: () => {
      const result: IntelligenceEvent[] = [];
      for (const e of get().events.values()) {
        if (e.status === 'active' || e.status === 'developing') result.push(e);
      }
      return result;
    },

    // --- Assets ---
    assets: new Map(),
    selectedAssetId: null,
    addAssets: (assets) => set((s) => {
      for (const a of assets) s.assets.set(a.id, a);
      debouncePersist('assets', Array.from(s.assets.values()));
    }),
    selectAsset: (id) => set((s) => { s.selectedAssetId = id; }),

    // --- Time ---
    currentTime: now,
    timeRange: { start: dayAgo, end: now },
    isPlaying: false,
    playbackSpeed: 1,
    setCurrentTime: (time) => set((s) => { s.currentTime = time; }),
    setTimeRange: (start, end) => set((s) => { s.timeRange = { start, end }; }),
    play: () => set((s) => { s.isPlaying = true; }),
    pause: () => set((s) => { s.isPlaying = false; }),
    setSpeed: (speed) => set((s) => { s.playbackSpeed = speed; }),

    // --- Watch areas ---
    watchAreas: [],
    addWatchArea: (area) => set((s) => {
      s.watchAreas.push(area);
      debouncePersist('watchAreas', s.watchAreas);
    }),
    removeWatchArea: (id) => set((s) => {
      s.watchAreas = s.watchAreas.filter((a) => a.id !== id);
      debouncePersist('watchAreas', s.watchAreas);
    }),
    updateWatchArea: (id, partial) => set((s) => {
      const idx = s.watchAreas.findIndex((a) => a.id === id);
      if (idx !== -1) {
        Object.assign(s.watchAreas[idx]!, partial);
        debouncePersist('watchAreas', s.watchAreas);
      }
    }),

    // --- Alerts ---
    alerts: [],
    addAlert: (alert) => set((s) => { s.alerts.unshift(alert); }),
    acknowledgeAlert: (id) => set((s) => {
      const alert = s.alerts.find((a) => a.id === id);
      if (alert) alert.acknowledged = true;
    }),
    clearAlerts: () => set((s) => { s.alerts = []; }),
    unacknowledgedCount: () => get().alerts.filter((a) => !a.acknowledged).length,

    // --- Source health ---
    sourceHealth: new Map(),
    overallHealth: 'healthy',
    updateSourceHealth: (checks) => set((s) => {
      for (const c of checks) s.sourceHealth.set(c.sourceId, c);
      const total = s.sourceHealth.size;
      if (total === 0) { s.overallHealth = 'unknown' as 'healthy'; return; }
      let healthy = 0;
      for (const c of s.sourceHealth.values()) { if (c.isHealthy) healthy++; }
      const ratio = healthy / total;
      s.overallHealth = ratio >= 0.8 ? 'healthy' : ratio >= 0.5 ? 'degraded' : 'critical';
    }),

    // --- Auth (legacy) ---
    auth: { isAuthenticated: false, user: null },
    login: (user) => set((s) => { s.auth = { isAuthenticated: true, user }; }),
    logout: () => set((s) => { s.auth = { isAuthenticated: false, user: null }; }),

    // --- Filters (legacy) ---
    filters: { ...DEFAULT_FILTERS },
    setModuleFilter: (module, enabled) => set((s) => { s.filters.modules[module] = enabled; }),
    setCategoryFilter: (category, enabled) => set((s) => { s.filters.categories[category] = enabled; }),
    setSeverityFilter: (severity, enabled) => set((s) => { s.filters.severities[severity] = enabled; }),
    setShowSynthetic: (show) => set((s) => { s.filters.showSynthetic = show; }),
    setSearchQuery: (query) => set((s) => { s.filters.searchQuery = query; }),
    setDateRange: (from, to) => set((s) => { s.filters.dateRange = { from, to }; }),
    setProvince: (province) => set((s) => { s.filters.province = province; }),
    resetFilters: () => set((s) => {
      s.filters = { ...DEFAULT_FILTERS, modules: { ...DEFAULT_FILTERS.modules }, severities: { ...DEFAULT_FILTERS.severities } };
    }),

    // --- UI (legacy) ---
    ui: {
      sidebarOpen: true,
      activePanel: 'layers',
      selectedIncidentId: null,
      mapStyle: 'standard',
      measureActive: false,
      mobileMenuOpen: false,
    },
    setActivePanel: (panel) => set((s) => { s.ui.activePanel = panel; }),
    setSelectedIncident: (id) => set((s) => {
      s.ui.selectedIncidentId = id;
      s.selectedEventId = id;
      s.ui.activePanel = id ? 'details' : s.ui.activePanel;
    }),
    setMapStyle: (style) => set((s) => { s.ui.mapStyle = style; }),
    setMeasureActive: (active) => set((s) => { s.ui.measureActive = active; }),
    setMobileMenuOpen: (open) => set((s) => { s.ui.mobileMenuOpen = open; }),

    // --- Widgets (legacy) ---
    widgetState: {
      widgets: DEFAULT_WIDGETS,
      panelOpen: true,
      newsFeedEnabled: true,
    },
    toggleWidget: (id) => set((s) => {
      const w = s.widgetState.widgets.find((w) => w.id === id);
      if (w) w.enabled = !w.enabled;
    }),
    setWidgetPosition: (id, position) => set((s) => {
      const w = s.widgetState.widgets.find((w) => w.id === id);
      if (w) w.position = position;
    }),
    reorderWidget: (id, direction) => set((s) => {
      const widgets = s.widgetState.widgets;
      const w = widgets.find((x) => x.id === id);
      if (!w) return;
      const samePos = widgets.filter((x) => x.position === w.position).sort((a, b) => a.order - b.order);
      const posIdx = samePos.findIndex((x) => x.id === id);
      if (direction === 'up' && posIdx > 0) {
        const other = samePos[posIdx - 1]!;
        const tmp = w.order;
        w.order = other.order;
        other.order = tmp;
      }
      if (direction === 'down' && posIdx < samePos.length - 1) {
        const other = samePos[posIdx + 1]!;
        const tmp = w.order;
        w.order = other.order;
        other.order = tmp;
      }
    }),
    setWidgetPanelOpen: (open) => set((s) => { s.widgetState.panelOpen = open; }),
    setNewsFeedEnabled: (enabled) => set((s) => { s.widgetState.newsFeedEnabled = enabled; }),

    // --- Ticker (legacy) ---
    ticker: {
      enabled: true,
      mode: 'rss',
      customText: 'Intelligence Twin — live situational awareness for South Africa\nAll incidents currently shown are synthetic test data\nReport an incident from the map toolbar',
      rssFeedId: null,
      direction: 'rtl',
      speedSeconds: 45,
      tone: 'normal',
      fontBold: false,
      fontColor: 'white',
    },
    updateTicker: (patch) => set((s) => { Object.assign(s.ticker, patch); }),

    // --- Sponsors (legacy) ---
    sponsorsEnabled: true,
    setSponsorsEnabled: (enabled) => set((s) => { s.sponsorsEnabled = enabled; }),

    // --- Dismissed alerts (legacy) ---
    dismissedAlertIds: {},
    dismissAlert: (id) => set((s) => { s.dismissedAlertIds[id] = true; }),
    dismissAllAlerts: (ids) => set((s) => { for (const id of ids) s.dismissedAlertIds[id] = true; }),
    clearDismissedAlerts: () => set((s) => { s.dismissedAlertIds = {}; }),

    // --- Moderator permissions ---
    modPermissions: {
      'mod.demo@example.com': { ...DEFAULT_MOD_PERMISSIONS },
    },
    modEnabled: {
      'mod.demo@example.com': true,
    },
    setModPermission: (email, key, value) => set((s) => {
      if (!s.modPermissions[email]) s.modPermissions[email] = { ...DEFAULT_MOD_PERMISSIONS };
      s.modPermissions[email]![key] = value;
    }),
    setModEnabled: (email, enabled) => set((s) => {
      s.modEnabled[email] = enabled;
    }),
    addModerator: (email) => set((s) => {
      if (!s.modPermissions[email]) s.modPermissions[email] = { ...DEFAULT_MOD_PERMISSIONS };
      if (s.modEnabled[email] === undefined) s.modEnabled[email] = true;
    }),
    removeModerator: (email) => set((s) => {
      delete s.modPermissions[email];
      delete s.modEnabled[email];
    }),

    // --- Feed freshness ---
    feedLastRefresh: {},
    markFeedRefreshed: (feedId) => set((s) => {
      s.feedLastRefresh[feedId] = Date.now();
    }),
    cleanStaleFeeds: () => {
      const now = Date.now();
      const FOUR_HOURS = 4 * 60 * 60 * 1000;
      const stale: string[] = [];
      const state = get();
      for (const [feedId, ts] of Object.entries(state.feedLastRefresh)) {
        if (now - ts > FOUR_HOURS) stale.push(feedId);
      }
      if (stale.length > 0) {
        set((s) => {
          for (const id of stale) delete s.feedLastRefresh[id];
        });
      }
      return stale;
    },

    // --- Hydration ---
    hydrate: async () => {
      const [events, assets, watchAreas] = await Promise.all([
        hydrateStore<IntelligenceEvent[]>('events'),
        hydrateStore<InfrastructureAsset[]>('assets'),
        hydrateStore<WatchArea[]>('watchAreas'),
      ]);
      set((s) => {
        if (events) for (const e of events) s.events.set(e.id, e);
        if (assets) for (const a of assets) s.assets.set(a.id, a);
        if (watchAreas) s.watchAreas = watchAreas;
      });
    },
  })),
);
