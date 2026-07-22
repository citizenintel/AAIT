import { create } from 'zustand';
import type { ModuleKey, IncidentSeverity, VerificationState, AppRole } from '../data/types';

interface FilterState {
  modules: Record<ModuleKey, boolean>;
  categories: Record<string, boolean>;
  severities: Record<IncidentSeverity, boolean>;
  showSynthetic: boolean;
  searchQuery: string;
  dateRange: { from: string | null; to: string | null };
  province: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: null | {
    id: string;
    email: string;
    displayName: string;
    role: AppRole;
    avatarUrl?: string;
  };
}

interface UIState {
  sidebarOpen: boolean;
  activePanel: 'layers' | 'details' | 'report' | 'search' | null;
  selectedIncidentId: string | null;
  mapStyle: 'standard' | 'light' | 'terrain' | 'satellite';
  measureActive: boolean;
  mobileMenuOpen: boolean;
}

export type WidgetId = 'stats_bar' | 'severity_pie' | 'module_pie' | 'province_bar' | 'trend_line' | 'news_ticker' | 'casualties_card' | 'verification_pie';

export interface WidgetConfig {
  id: WidgetId;
  enabled: boolean;
  position: 'top' | 'right' | 'bottom';
  order: number;
}

interface WidgetState {
  widgets: WidgetConfig[];
  panelOpen: boolean;
  newsFeedEnabled: boolean;
}

export interface TickerConfig {
  enabled: boolean;
  mode: 'custom' | 'rss';
  customText: string;           // one ticker item per line
  rssFeedId: string | null;     // null = all enabled feeds
  direction: 'ltr' | 'rtl';
  speedSeconds: number;         // duration of one full scroll loop
  tone: 'normal' | 'alert';     // normal = bright white, alert = bright red
}

interface AlertState {
  dismissedIds: Record<string, true>;
}

interface AppStore {
  filters: FilterState;
  auth: AuthState;
  ui: UIState;
  widgetState: WidgetState;
  ticker: TickerConfig;
  sponsorsEnabled: boolean;
  alerts: AlertState;

  setModuleFilter: (module: ModuleKey, enabled: boolean) => void;
  setCategoryFilter: (category: string, enabled: boolean) => void;
  setSeverityFilter: (severity: IncidentSeverity, enabled: boolean) => void;
  setShowSynthetic: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setProvince: (province: string | null) => void;
  resetFilters: () => void;

  login: (user: AuthState['user']) => void;
  logout: () => void;

  setSidebarOpen: (open: boolean) => void;
  setActivePanel: (panel: UIState['activePanel']) => void;
  setSelectedIncident: (id: string | null) => void;
  setMapStyle: (style: UIState['mapStyle']) => void;
  setMeasureActive: (active: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;

  toggleWidget: (id: WidgetId) => void;
  setWidgetPosition: (id: WidgetId, position: WidgetConfig['position']) => void;
  reorderWidget: (id: WidgetId, direction: 'up' | 'down') => void;
  setWidgetPanelOpen: (open: boolean) => void;
  setNewsFeedEnabled: (enabled: boolean) => void;

  updateTicker: (patch: Partial<TickerConfig>) => void;
  setSponsorsEnabled: (enabled: boolean) => void;

  dismissAlert: (id: string) => void;
  dismissAllAlerts: (ids: string[]) => void;
  clearDismissedAlerts: () => void;
}

const DEFAULT_FILTERS: FilterState = {
  modules: { ait: true, unrest: true, bias: true, infrastructure: true, natural: true },
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

export const useAppStore = create<AppStore>((set) => ({
  filters: { ...DEFAULT_FILTERS },
  auth: { isAuthenticated: false, user: null },
  ui: {
    sidebarOpen: true,
    activePanel: 'layers',
    selectedIncidentId: null,
    mapStyle: 'standard',
    measureActive: false,
    mobileMenuOpen: false,
  },
  widgetState: {
    widgets: DEFAULT_WIDGETS,
    panelOpen: true,
    newsFeedEnabled: true,
  },
  ticker: {
    enabled: true,
    mode: 'rss',
    customText: 'Alt Afrikaner Incident Tracker — live situational awareness for South Africa\nAll incidents currently shown are synthetic test data\nReport an incident from the map toolbar',
    rssFeedId: null,
    direction: 'rtl',
    speedSeconds: 45,
    tone: 'normal',
  },
  sponsorsEnabled: true,
  alerts: { dismissedIds: {} },

  setModuleFilter: (module, enabled) =>
    set((s) => ({ filters: { ...s.filters, modules: { ...s.filters.modules, [module]: enabled } } })),
  setCategoryFilter: (category, enabled) =>
    set((s) => ({ filters: { ...s.filters, categories: { ...s.filters.categories, [category]: enabled } } })),
  setSeverityFilter: (severity, enabled) =>
    set((s) => ({ filters: { ...s.filters, severities: { ...s.filters.severities, [severity]: enabled } } })),
  setShowSynthetic: (show) =>
    set((s) => ({ filters: { ...s.filters, showSynthetic: show } })),
  setSearchQuery: (query) =>
    set((s) => ({ filters: { ...s.filters, searchQuery: query } })),
  setDateRange: (from, to) =>
    set((s) => ({ filters: { ...s.filters, dateRange: { from, to } } })),
  setProvince: (province) =>
    set((s) => ({ filters: { ...s.filters, province } })),
  resetFilters: () =>
    set({ filters: { ...DEFAULT_FILTERS } }),

  login: (user) =>
    set({ auth: { isAuthenticated: true, user } }),
  logout: () =>
    set({ auth: { isAuthenticated: false, user: null } }),

  setSidebarOpen: (open) =>
    set((s) => ({ ui: { ...s.ui, sidebarOpen: open } })),
  setActivePanel: (panel) =>
    set((s) => ({ ui: { ...s.ui, activePanel: panel } })),
  setSelectedIncident: (id) =>
    set((s) => ({ ui: { ...s.ui, selectedIncidentId: id, activePanel: id ? 'details' : s.ui.activePanel } })),
  setMapStyle: (style) =>
    set((s) => ({ ui: { ...s.ui, mapStyle: style } })),
  setMeasureActive: (active) =>
    set((s) => ({ ui: { ...s.ui, measureActive: active } })),
  setMobileMenuOpen: (open) =>
    set((s) => ({ ui: { ...s.ui, mobileMenuOpen: open } })),

  toggleWidget: (id) =>
    set((s) => ({
      widgetState: {
        ...s.widgetState,
        widgets: s.widgetState.widgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w),
      },
    })),
  setWidgetPosition: (id, position) =>
    set((s) => ({
      widgetState: {
        ...s.widgetState,
        widgets: s.widgetState.widgets.map(w => w.id === id ? { ...w, position } : w),
      },
    })),
  reorderWidget: (id, direction) =>
    set((s) => {
      const widgets = [...s.widgetState.widgets];
      const idx = widgets.findIndex(w => w.id === id);
      if (idx < 0) return s;
      const w = widgets[idx]!;
      const samePos = widgets.filter(x => x.position === w.position).sort((a, b) => a.order - b.order);
      const posIdx = samePos.findIndex(x => x.id === id);
      if (direction === 'up' && posIdx > 0) {
        const other = samePos[posIdx - 1]!;
        const tmpOrder = w.order;
        return {
          widgetState: {
            ...s.widgetState,
            widgets: widgets.map(x => x.id === id ? { ...x, order: other.order } : x.id === other.id ? { ...x, order: tmpOrder } : x),
          },
        };
      }
      if (direction === 'down' && posIdx < samePos.length - 1) {
        const other = samePos[posIdx + 1]!;
        const tmpOrder = w.order;
        return {
          widgetState: {
            ...s.widgetState,
            widgets: widgets.map(x => x.id === id ? { ...x, order: other.order } : x.id === other.id ? { ...x, order: tmpOrder } : x),
          },
        };
      }
      return s;
    }),
  setWidgetPanelOpen: (open) =>
    set((s) => ({ widgetState: { ...s.widgetState, panelOpen: open } })),
  setNewsFeedEnabled: (enabled) =>
    set((s) => ({ widgetState: { ...s.widgetState, newsFeedEnabled: enabled } })),

  updateTicker: (patch) =>
    set((s) => ({ ticker: { ...s.ticker, ...patch } })),
  setSponsorsEnabled: (enabled) => set({ sponsorsEnabled: enabled }),

  dismissAlert: (id) =>
    set((s) => ({ alerts: { dismissedIds: { ...s.alerts.dismissedIds, [id]: true } } })),
  dismissAllAlerts: (ids) =>
    set((s) => {
      const next = { ...s.alerts.dismissedIds };
      for (const id of ids) next[id] = true;
      return { alerts: { dismissedIds: next } };
    }),
  clearDismissedAlerts: () =>
    set({ alerts: { dismissedIds: {} } }),
}));
