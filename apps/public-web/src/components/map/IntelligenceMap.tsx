import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre-setup';
import { formatDistanceToNow } from 'date-fns';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '@/data/mock-incidents';
import type { MockIncident } from '@/data/mock-incidents';
import { deconflictCoordinates } from '@/lib/utils/map-deconflict';
import { resolveCoords } from '@/lib/utils/sa-coordinates';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import { useAppStore } from '@/stores/app-store';
import type {
  IntelligenceEvent,
  InfrastructureAsset,
  RenderingTier,
  MissionLens,
  EventType,
} from '@/types/ontology';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntelligenceMapProps {
  events: IntelligenceEvent[];
  assets: InfrastructureAsset[];
  incidents: MockIncident[];
  renderingTier: RenderingTier;
  activeLens: MissionLens | null;
  selectedEventId: string | null;
  onEventSelect: (id: string | null) => void;
  currentTime: Date;
  flyToCenter?: [number, number];
  flyToZoom?: number;
}

// ---------------------------------------------------------------------------
// Colour map — event type to hex
// ---------------------------------------------------------------------------

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  conflict: '#ef4444',
  protest: '#f97316',
  crime: '#ef4444',
  natural_disaster: '#eab308',
  infrastructure_failure: '#3b82f6',
  political: '#8b5cf6',
  economic: '#06b6d4',
  health: '#22c55e',
  environmental: '#10b981',
  cyber: '#a855f7',
  maritime: '#0ea5e9',
  aviation: '#64748b',
  energy: '#f59e0b',
  market_event: '#6366f1',
  other: '#6366f1',
};

// Built once at module scope — depends on nothing reactive.
const EVENT_COLOR_MATCH: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'type'],
  'conflict', EVENT_TYPE_COLORS.conflict,
  'protest', EVENT_TYPE_COLORS.protest,
  'crime', EVENT_TYPE_COLORS.crime,
  'natural_disaster', EVENT_TYPE_COLORS.natural_disaster,
  'infrastructure_failure', EVENT_TYPE_COLORS.infrastructure_failure,
  'political', EVENT_TYPE_COLORS.political,
  'economic', EVENT_TYPE_COLORS.economic,
  'health', EVENT_TYPE_COLORS.health,
  'environmental', EVENT_TYPE_COLORS.environmental,
  'cyber', EVENT_TYPE_COLORS.cyber,
  'maritime', EVENT_TYPE_COLORS.maritime,
  'aviation', EVENT_TYPE_COLORS.aviation,
  'energy', EVENT_TYPE_COLORS.energy,
  'market_event', EVENT_TYPE_COLORS.market_event,
  '#6366f1', // default
];

// ---------------------------------------------------------------------------
// Map basemaps — each key returns a fresh style; switching uses setStyle()
// ---------------------------------------------------------------------------

function satelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8 as const,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
      },
      'carto-labels': {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
        maxzoom: 18,
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0a1a2e' } },
      { id: 'satellite-tiles', type: 'raster', source: 'esri-satellite', paint: { 'raster-fade-duration': 300 } },
      { id: 'label-tiles', type: 'raster', source: 'carto-labels', paint: { 'raster-fade-duration': 300 } },
    ],
  };
}

function getBasemapStyle(key: string): string | maplibregl.StyleSpecification {
  switch (key) {
    case 'light':
      return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    case 'terrain':
      return {
        version: 8 as const,
        sources: {
          opentopomap: {
            type: 'raster',
            tiles: [
              'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            maxzoom: 17,
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#d4c6a1' } },
          { id: 'topo-tiles', type: 'raster', source: 'opentopomap', paint: { 'raster-fade-duration': 300 } },
        ],
      };
    case 'satellite':
    case '3d':
      return satelliteStyle();
    default:
      return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
  }
}

const STYLE_LABELS: Record<string, string> = {
  standard: 'Standard', light: 'Light', terrain: 'Terrain', satellite: 'Satellite', '3d': '3D',
};

type MapStyleKey = 'standard' | 'light' | 'terrain' | 'satellite' | '3d';

// ---------------------------------------------------------------------------
// 3D terrain source (AWS open dataset, terrarium encoding)
// ---------------------------------------------------------------------------

const TERRAIN_SOURCE = 'terrain-dem';
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// ---------------------------------------------------------------------------
// Roads overlay
// ---------------------------------------------------------------------------

const ROADS_SOURCE = 'ofm-roads';
const ROADS_TILEJSON = 'https://tiles.openfreemap.org/planet';
const ROADS_LAYER_SRC = 'transportation';
const ROADS_CASING = 'roads-casing';
const ROADS_OVERLAY = 'roads-overlay';
const ROAD_LAYER_RE = /road|street|motorway|trunk|primary|secondary|tertiary|highway|bridge|tunnel/i;

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

interface MeasureState {
  active: boolean;
  points: [number, number][];
  totalKm: number;
}

const MEASURE_SOURCE = 'measure-source';
const MEASURE_LINE_LAYER = 'measure-line';
const MEASURE_POINT_LAYER = 'measure-points';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km (${(km * 0.621371).toFixed(2)} mi)`;
}

// ---------------------------------------------------------------------------
// GeoJSON helpers
// ---------------------------------------------------------------------------

const EVENTS_SOURCE = 'intelligence-events';
const EVENTS_LAYER = 'intelligence-events-circles';
const INCIDENTS_SOURCE = 'mock-incidents';
const INCIDENTS_LAYER = 'mock-incidents-circles';
const INCIDENTS_PULSE_LAYER = 'mock-incidents-pulse';

function eventsToGeoJSON(
  events: IntelligenceEvent[],
  currentTime: Date,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const evt of events) {
    const ts = evt.timestamp instanceof Date ? evt.timestamp : new Date(evt.timestamp);
    if (ts.getTime() > currentTime.getTime()) continue;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [evt.location.longitude, evt.location.latitude],
      },
      properties: {
        id: evt.id,
        type: evt.type,
        title: evt.title,
        confidence: evt.confidence.overall,
        confidenceLevel: evt.confidence.level,
        timestamp: ts.toISOString(),
        status: evt.status,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function incidentsToGeoJSON(incidents: MockIncident[]): GeoJSON.FeatureCollection {
  const DEFAULT_MODULE = MODULE_META.ait;
  const DEFAULT_SEVERITY = SEVERITY_META.medium;
  const resolvedList: { id: string; lat: number; lng: number }[] = [];
  const resolvedMap = new Map<string, { lat: number; lng: number }>();
  for (const inc of incidents) {
    const rc = resolveCoords(inc);
    if (rc) { resolvedList.push({ id: inc.id, ...rc }); resolvedMap.set(inc.id, rc); }
  }
  const coordMap = deconflictCoordinates(resolvedList);
  const features: GeoJSON.Feature[] = [];
  for (const inc of incidents) {
    const baseCoords = resolvedMap.get(inc.id);
    if (!baseCoords) continue;
    const coords = coordMap.get(inc.id) ?? baseCoords;
    const modMeta = MODULE_META[inc.module as keyof typeof MODULE_META] ?? DEFAULT_MODULE;
    const sevMeta = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META] ?? DEFAULT_SEVERITY;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
      properties: {
        id: inc.id,
        title: inc.title,
        module: inc.module,
        severity: inc.severity,
        verification: inc.verification,
        town: inc.town,
        province: inc.province,
        moduleColour: modMeta.colour,
        severityColour: sevMeta.colour,
        moduleLabel: modMeta.label,
        severityLabel: sevMeta.label,
        dateOccurred: inc.dateOccurred,
        deceased: inc.casualties?.deceased ?? 0,
        injured: inc.casualties?.injured ?? 0,
        isSynthetic: inc.isSynthetic,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntelligenceMap({
  events,
  assets: _assets,
  incidents,
  renderingTier,
  activeLens: _activeLens,
  selectedEventId,
  onEventSelect,
  currentTime,
  flyToCenter,
  flyToZoom,
}: IntelligenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const deckOverlayRef = useRef<unknown>(null);

  // Which basemap key the CURRENT map instance was built with. Reset by the
  // init effect, so a StrictMode remount can never trigger a spurious setStyle.
  const appliedStyleKeyRef = useRef<MapStyleKey | null>(null);

  // (source instance, data object) pairs already pushed to the map. setStyle
  // destroys and recreates sources, so comparing the instance is what makes
  // re-population after a basemap switch automatic.
  const appliedEventsRef = useRef<{ src: unknown; data: unknown } | null>(null);
  const appliedIncidentsRef = useRef<{ src: unknown; data: unknown } | null>(null);

  // Watchdog that drives syncMapContent until it reports success.
  const watchdogRef = useRef<number | null>(null);
  const watchdogStartRef = useRef<number>(0);
  const watchdogWarnedRef = useRef(false);
  const layersReadyRef = useRef(false);
  const [layersReady, setLayersReady] = useState(false);
  // Set when the basemap's own tiles/style fail. Without this a broken basemap
  // renders as an empty background layer and is indistinguishable from a bug in
  // our own layers — which is exactly how this went undiagnosed for so long.
  const [basemapError, setBasemapError] = useState<string | null>(null);

  // Style / control state
  const [activeStyle, setActiveStyle] = useState<MapStyleKey>('standard');
  const [measure, setMeasure] = useState<MeasureState>({ active: false, points: [], totalKm: 0 });
  const [showRoads, setShowRoads] = useState(false);
  const [show3DHint, setShow3DHint] = useState(false);

  // Refs so event handlers always see current state
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const showRoadsRef = useRef(showRoads);
  showRoadsRef.current = showRoads;

  // Memoize the filtered feature collection
  const geojson = useMemo(
    () => eventsToGeoJSON(events, currentTime),
    [events, currentTime],
  );
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  const incidentsGeoJson = useMemo(
    () => incidentsToGeoJSON(incidents),
    [incidents],
  );
  const markerCount = incidentsGeoJson.features.length;
  // Incidents that produced no feature because their location could not be
  // resolved. Surfaced in the badge rather than silently discarded.
  const unmappedCount = Math.max(0, incidents.length - markerCount);
  const incidentsGeoJsonRef = useRef(incidentsGeoJson);
  incidentsGeoJsonRef.current = incidentsGeoJson;

  useEffect(() => {
    if (unmappedCount > 0) {
      console.warn(
        `[Map] ${unmappedCount} of ${incidents.length} incidents have no resolvable location and are not plotted.`,
      );
    }
  }, [unmappedCount, incidents.length]);

  /**
   * Diagnostics only — the map still renders from the `incidents` PROP, so the
   * component contract is unchanged. The hook is read here rather than plumbed
   * through three separate call sites (GlanceView, InvestigateView, BriefView)
   * because forgetting one of those props would silently reinstate the blank
   * map with no explanation. Outside a provider this returns the default
   * context (all zeros, All time), so it cannot throw.
   */
  const {
    allIncidents,
    awaitingReview,
    mergedCount,
    outsideWindowCount,
    undatedCount,
    undatedIncluded,
    filterActive,
    filterLabel,
    loading: incidentsLoading,
  } = useIncidentData();
  const setTimeFilter = useAppStore((s) => s.setTimeFilter);
  const setIncludeUndated = useAppStore((s) => s.setIncludeUndated);

  const visibleCount = geojson.features.length;

  // ------------------------------------------------------------------
  // Error reporting — never silent again
  // ------------------------------------------------------------------
  const logMapError = useCallback((where: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Style is not done loading')) {
      // Expected while the style is parsing; the watchdog will retry.
      console.debug(`[Map] ${where}: style not ready, will retry`);
    } else {
      console.warn(`[Map] ${where} failed:`, err);
    }
  }, []);

  // ------------------------------------------------------------------
  // THE authoritative routine. Idempotent, cheap when already in sync.
  // Creates every missing source/layer, then pushes current data.
  // Returns true ONLY when both incident layers exist AND the current
  // incident collection has been applied to the live source instance.
  // Nothing else in this component may call addSource/addLayer/setData
  // for the events or incidents layers.
  // ------------------------------------------------------------------
  const syncMapContent = useCallback((map: maplibregl.Map): boolean => {
    if (!map) return false;
    if (!(map as unknown as { style?: unknown }).style) return false;

    // --- events source ---
    try {
      if (!map.getSource(EVENTS_SOURCE)) {
        map.addSource(EVENTS_SOURCE, { type: 'geojson', data: geojsonRef.current });
        appliedEventsRef.current = null;
        console.info('[Map] addSource(intelligence-events) ok');
      }
    } catch (err) { logMapError('addSource(intelligence-events)', err); }

    // --- events layer (own try: must not be skipped by a source failure) ---
    try {
      if (map.getSource(EVENTS_SOURCE) && !map.getLayer(EVENTS_LAYER)) {
        map.addLayer({
          id: EVENTS_LAYER,
          type: 'circle',
          source: EVENTS_SOURCE,
          paint: {
            'circle-color': EVENT_COLOR_MATCH,
            'circle-radius': ['interpolate', ['linear'], ['get', 'confidence'], 0, 4, 100, 12],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.15)',
          },
        });
        if (map.getLayer(EVENTS_LAYER)) {
          console.info('[Map] addLayer(intelligence-events-circles) ok');
        } else {
          console.warn('[Map] addLayer(intelligence-events-circles) returned without creating the layer — style-spec validation rejected it.');
        }
      }
    } catch (err) { logMapError('addLayer(intelligence-events-circles)', err); }

    // --- incidents source ---
    try {
      if (!map.getSource(INCIDENTS_SOURCE)) {
        map.addSource(INCIDENTS_SOURCE, { type: 'geojson', data: incidentsGeoJsonRef.current });
        appliedIncidentsRef.current = null;
        console.info('[Map] addSource(mock-incidents) ok');
      }
    } catch (err) { logMapError('addSource(mock-incidents)', err); }

    const incidentSource = map.getSource(INCIDENTS_SOURCE) as maplibregl.GeoJSONSource | undefined;

    // --- incidents pulse layer (own try: MUST NOT block the main layer) ---
    try {
      if (incidentSource && !map.getLayer(INCIDENTS_PULSE_LAYER)) {
        map.addLayer({
          id: INCIDENTS_PULSE_LAYER,
          type: 'circle',
          source: INCIDENTS_SOURCE,
          filter: ['==', ['get', 'severity'], 'critical'],
          paint: {
            'circle-color': ['get', 'severityColour'],
            'circle-radius': 16,
            'circle-opacity': 0.15,
            'circle-stroke-width': 0,
          },
        });
        if (map.getLayer(INCIDENTS_PULSE_LAYER)) {
          console.info('[Map] addLayer(mock-incidents-pulse) ok');
        } else {
          console.warn('[Map] addLayer(mock-incidents-pulse) returned without creating the layer — style-spec validation rejected it.');
        }
      }
    } catch (err) { logMapError('addLayer(mock-incidents-pulse)', err); }

    // --- incidents main layer (own try) ---
    try {
      if (incidentSource && !map.getLayer(INCIDENTS_LAYER)) {
        map.addLayer({
          id: INCIDENTS_LAYER,
          type: 'circle',
          source: INCIDENTS_SOURCE,
          paint: {
            'circle-color': ['get', 'moduleColour'],
            'circle-radius': [
              'match', ['get', 'severity'],
              'critical', 9, 'high', 7, 'medium', 6, 'low', 5, 5,
            ],
            'circle-opacity': 0.9,
            'circle-stroke-width': ['match', ['get', 'severity'], 'critical', 3, 'high', 2, 2],
            'circle-stroke-color': ['get', 'severityColour'],
          },
        });
        if (map.getLayer(INCIDENTS_LAYER)) {
          console.info('[Map] addLayer(mock-incidents-circles) ok');
        } else {
          console.warn('[Map] addLayer(mock-incidents-circles) returned without creating the layer — style-spec validation rejected it.');
        }
      }
    } catch (err) { logMapError('addLayer(mock-incidents-circles)', err); }

    // --- push events data ---
    try {
      const evSrc = map.getSource(EVENTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (evSrc) {
        const a = appliedEventsRef.current;
        if (!a || a.src !== evSrc || a.data !== geojsonRef.current) {
          evSrc.setData(geojsonRef.current);
          appliedEventsRef.current = { src: evSrc, data: geojsonRef.current };
          console.info('[Map] setData(intelligence-events):', geojsonRef.current.features.length, 'features');
        }
      }
    } catch (err) { logMapError('setData(intelligence-events)', err); }

    // --- push incidents data ---
    try {
      if (incidentSource) {
        const a = appliedIncidentsRef.current;
        if (!a || a.src !== incidentSource || a.data !== incidentsGeoJsonRef.current) {
          incidentSource.setData(incidentsGeoJsonRef.current);
          appliedIncidentsRef.current = { src: incidentSource, data: incidentsGeoJsonRef.current };
          console.info('[Map] setData(mock-incidents):', incidentsGeoJsonRef.current.features.length, 'features');
        }
      }
    } catch (err) { logMapError('setData(mock-incidents)', err); }

    // --- post-conditions: layer presence, not source presence ---
    // INCIDENTS_PULSE_LAYER is deliberately excluded: it is decorative, and in
    // MapLibre v6 addLayer reports spec-validation failure via an ErrorEvent
    // rather than throwing. Gating on it would let a cosmetic failure spin the
    // watchdog forever while the real circles are already on screen.
    const ok = !!map.getSource(INCIDENTS_SOURCE)
      && !!map.getLayer(INCIDENTS_LAYER)
      && appliedIncidentsRef.current?.data === incidentsGeoJsonRef.current;

    if (ok !== layersReadyRef.current) {
      layersReadyRef.current = ok;
      setLayersReady(ok);
      console.info('[Map] layersReady =', ok);
    }
    return ok;
  }, [logMapError]);

  // Stable handle so event listeners registered once can always call the latest closure.
  const syncRef = useRef(syncMapContent);
  syncRef.current = syncMapContent;

  // ------------------------------------------------------------------
  // Watchdog driver. Runs the sync immediately; if it fails, arms a poll
  // that clears itself the moment the sync succeeds. No 30s cap, no latch.
  // ------------------------------------------------------------------
  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const requestSync = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (syncRef.current(map)) { stopWatchdog(); return; }
    if (watchdogRef.current !== null) return;
    watchdogStartRef.current = Date.now();
    watchdogWarnedRef.current = false;
    watchdogRef.current = window.setInterval(() => {
      const m = mapRef.current;
      if (!m) { stopWatchdog(); return; }
      if (syncRef.current(m)) { stopWatchdog(); return; }
      if (!watchdogWarnedRef.current && Date.now() - watchdogStartRef.current > 15000) {
        watchdogWarnedRef.current = true;
        console.warn('[Map] incident layers still not installed after 15s.', {
          styleLoaded: m.isStyleLoaded(),
          mapLoaded: m.loaded(),
          hasSource: !!m.getSource(INCIDENTS_SOURCE),
          hasLayer: !!m.getLayer(INCIDENTS_LAYER),
          hasPulse: !!m.getLayer(INCIDENTS_PULSE_LAYER),
          features: incidentsGeoJsonRef.current.features.length,
          layerOrder: (m.getStyle()?.layers ?? []).map(l => l.id),
        });
      }
    }, 400);
  }, [stopWatchdog]);

  const requestSyncRef = useRef(requestSync);
  requestSyncRef.current = requestSync;

  // ------------------------------------------------------------------
  // Measure layers
  // ------------------------------------------------------------------
  const addMeasureLayers = useCallback((map: maplibregl.Map) => {
    try {
      if (!map.getSource(MEASURE_SOURCE)) {
        map.addSource(MEASURE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (map.getSource(MEASURE_SOURCE) && !map.getLayer(MEASURE_LINE_LAYER)) {
        map.addLayer({
          id: MEASURE_LINE_LAYER, type: 'line', source: MEASURE_SOURCE,
          filter: ['==', '$type', 'LineString'],
          paint: { 'line-color': '#c9a84c', 'line-width': 2.5, 'line-dasharray': [3, 2] },
        });
      }
      if (map.getSource(MEASURE_SOURCE) && !map.getLayer(MEASURE_POINT_LAYER)) {
        map.addLayer({
          id: MEASURE_POINT_LAYER, type: 'circle', source: MEASURE_SOURCE,
          filter: ['==', '$type', 'Point'],
          paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#c9a84c', 'circle-stroke-width': 2 },
        });
      }
    } catch (err) {
      logMapError('addMeasureLayers', err);
    }
  }, [logMapError]);

  const updateMeasureGeometry = useCallback((map: maplibregl.Map, points: [number, number][]) => {
    const source = map.getSource(MEASURE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const features: GeoJSON.Feature[] = points.map(p => ({
      type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: p }, properties: {},
    }));
    if (points.length >= 2) {
      features.push({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: points }, properties: {} });
    }
    source.setData({ type: 'FeatureCollection', features });
  }, []);

  const clearMeasure = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      const source = map.getSource(MEASURE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData({ type: 'FeatureCollection', features: [] });
      map.getCanvas().style.cursor = '';
    }
    setMeasure({ active: false, points: [], totalKm: 0 });
  }, []);

  // ------------------------------------------------------------------
  // 3D terrain
  // ------------------------------------------------------------------
  const enable3D = useCallback((map: maplibregl.Map) => {
    if (!map.getSource(TERRAIN_SOURCE)) {
      map.addSource(TERRAIN_SOURCE, { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 14 });
    }
    map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.6 });
    const setSky = (map as unknown as { setSky?: (s: unknown) => void }).setSky;
    if (typeof setSky === 'function') {
      setSky.call(map, {
        'sky-color': '#12263f', 'horizon-color': '#0c1626', 'fog-color': '#0f1117',
        'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.4, 'atmosphere-blend': 0.7,
      });
    }
    // Stay where the user is. Previously this flew to Cape Town at zoom 11
    // whenever zoom < 7 — and since the default zoom is 5.5, the first click on
    // 3D always teleported away from the incidents, which reads as "3D lost my
    // data". Tilt in place instead, nudging zoom only enough for relief to show.
    const zoom = map.getZoom();
    map.easeTo({
      ...(zoom < 7 ? { zoom: 7.5 } : {}),
      pitch: zoom < 7 ? 70 : 78,
      duration: 1400,
      essential: true,
    });
  }, []);

  const disable3D = useCallback((map: maplibregl.Map) => {
    try { map.setTerrain(null); } catch { /* no terrain set */ }
    const setSky = (map as unknown as { setSky?: (s: unknown) => void }).setSky;
    if (typeof setSky === 'function') { try { setSky.call(map, undefined); } catch { /* ignore */ } }
    if (map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 600 });
  }, []);

  // ------------------------------------------------------------------
  // Roads
  // ------------------------------------------------------------------
  const applyRoads = useCallback((map: maplibregl.Map, styleKey: MapStyleKey, show: boolean): boolean => {
    const isVector = styleKey === 'standard' || styleKey === 'light';
    if (isVector) {
      if (map.getLayer(ROADS_OVERLAY)) map.removeLayer(ROADS_OVERLAY);
      if (map.getLayer(ROADS_CASING)) map.removeLayer(ROADS_CASING);
      const roadLayers = (map.getStyle()?.layers ?? []).filter((l: { id: string }) => ROAD_LAYER_RE.test(l.id));
      for (const l of roadLayers) {
        try { map.setLayoutProperty(l.id, 'visibility', show ? 'visible' : 'none'); } catch { /* layer gone */ }
      }
      return roadLayers.length > 0;
    }
    // raster basemaps (satellite / terrain / 3D): overlay vector road lines
    if (show) {
      if (!map.getSource(ROADS_SOURCE)) {
        map.addSource(ROADS_SOURCE, { type: 'vector', url: ROADS_TILEJSON });
      }
      const beforeId = map.getLayer(MEASURE_LINE_LAYER) ? MEASURE_LINE_LAYER : undefined;
      if (!map.getLayer(ROADS_CASING)) {
        map.addLayer({
          id: ROADS_CASING, type: 'line', source: ROADS_SOURCE, 'source-layer': ROADS_LAYER_SRC,
          filter: ['!=', ['get', 'class'], 'path'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': 'rgba(0,0,0,0.55)',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 10, 2.6, 14, 5.5, 18, 12],
          },
        }, beforeId);
      }
      if (!map.getLayer(ROADS_OVERLAY)) {
        map.addLayer({
          id: ROADS_OVERLAY, type: 'line', source: ROADS_SOURCE, 'source-layer': ROADS_LAYER_SRC,
          filter: ['!=', ['get', 'class'], 'path'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': [
              'match', ['get', 'class'],
              'motorway', '#f6a545',
              'trunk', '#f6c945',
              ['primary', 'secondary'], '#f4d97a',
              '#e6e2d3',
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 1.4, 14, 3, 18, 7],
          },
        }, beforeId);
      }
    } else {
      if (map.getLayer(ROADS_OVERLAY)) map.removeLayer(ROADS_OVERLAY);
      if (map.getLayer(ROADS_CASING)) map.removeLayer(ROADS_CASING);
    }
    return true;
  }, []);

  // ------------------------------------------------------------------
  // Initialise the map
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getBasemapStyle('standard'),
      center: [25.5, -28.0],
      zoom: 5.5,
      minZoom: 3,
      maxZoom: 18,
      maxPitch: 85,
      attributionControl: false,
    });

    // Assign before ANY listener is registered so every handler can rely on it.
    mapRef.current = map;
    appliedStyleKeyRef.current = 'standard';
    appliedEventsRef.current = null;
    appliedIncidentsRef.current = null;
    layersReadyRef.current = false;

    console.info('[Map] init: map instance created');

    // Dev-only introspection handle — inspect the live map from the console.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__map = map;
      console.info('[Map] window.__map is available (dev only)');
    }

    // Surface MapLibre ErrorEvents (addLayer spec-validation failures never throw in v6)
    map.on('error', (e) => {
      const ev = e as unknown as { error?: { message?: string; status?: number }; sourceId?: string };
      const err = ev?.error;
      console.warn('[Map] maplibre error event:', err ?? e, ev?.sourceId ? `(source: ${ev.sourceId})` : '');

      // Distinguish a basemap failure from a failure of our own overlays.
      const ours = ev?.sourceId === EVENTS_SOURCE
        || ev?.sourceId === INCIDENTS_SOURCE
        || ev?.sourceId === MEASURE_SOURCE;
      if (!ours) {
        const status = err?.status ? ` (HTTP ${err.status})` : '';
        setBasemapError(`Basemap tiles failed to load${status}. Try another basemap.`);
      }
    });

    map.on('load', () => {
      console.info('[Map] load fired');
      requestSyncRef.current();
      addMeasureLayers(map);
      tryAddDeckOverlayRef.current(map);
    });

    const pushViewport = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      useAppStore.getState().setMapViewport({
        bounds: [[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]],
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
      });
    };
    map.on('moveend', pushViewport);
    map.on('load', pushViewport);

    // Force repaints when raster tiles finish loading (fixes blank tile boxes in MapLibre v6)
    map.on('sourcedata', (e: maplibregl.MapSourceDataEvent) => {
      if (e.isSourceLoaded && e.dataType === 'source') {
        map.triggerRepaint();
      }
    });

    // Any style mutation (including setStyle, which wipes custom sources/layers).
    // 'load' is not a reliable trigger — it has been observed never firing while
    // the style is otherwise usable — so the deck.gl overlay hangs off this too.
    // Both calls are idempotent.
    map.on('styledata', () => {
      requestSyncRef.current();
      addMeasureLayers(map);
      tryAddDeckOverlayRef.current(map);
    });

    // Last-resort trigger — runs whenever the map settles.
    map.on('idle', () => {
      requestSyncRef.current();
      tryAddDeckOverlayRef.current(map);
    });

    // Measure click handler (runs on every map click; only acts when measuring)
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const state = measureRef.current;
      if (!state.active) return;
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const newPoints = [...state.points, coords];
      let totalKm = state.totalKm;
      if (newPoints.length >= 2) {
        const prev = newPoints[newPoints.length - 2]!;
        totalKm += haversineKm(prev[1], prev[0], coords[1], coords[0]);
      }
      setMeasure({ active: true, points: newPoints, totalKm });
      updateMeasureGeometry(map, newPoints);
    });

    // Click handler for event circles
    map.on('click', EVENTS_LAYER, (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (measureRef.current.active) return;

      const feature = e.features?.[0];
      if (!feature || !feature.properties) return;

      const id = feature.properties.id as string;
      onEventSelect(id);

      // Show popup
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const title = feature.properties.title as string;
      const confidenceLevel = feature.properties.confidenceLevel as string;
      const timestamp = feature.properties.timestamp as string;

      let timeAgo = '';
      try {
        timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });
      } catch {
        timeAgo = timestamp;
      }

      if (popupRef.current) popupRef.current.remove();

      popupRef.current = new maplibregl.Popup({
        offset: 12,
        closeButton: true,
        maxWidth: '280px',
      })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:var(--font-body);padding:6px 2px">` +
          `<div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:4px">${escapeHtml(title)}</div>` +
          `<div style="display:flex;gap:8px;font-size:11px;color:#555">` +
          `<span style="text-transform:capitalize">${escapeHtml(confidenceLevel.replace(/_/g, ' '))}</span>` +
          `<span>${escapeHtml(timeAgo)}</span>` +
          `</div></div>`,
        )
        .addTo(map);
    });

    // Cursor on hover (respect measure mode)
    map.on('mouseenter', EVENTS_LAYER, () => {
      if (!measureRef.current.active) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', EVENTS_LAYER, () => {
      if (!measureRef.current.active) map.getCanvas().style.cursor = '';
    });

    // Click handler for mock incident circles
    map.on('click', INCIDENTS_LAYER, (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (measureRef.current.active) return;

      const feature = e.features?.[0];
      if (!feature || !feature.properties) return;
      const p = feature.properties;
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];

      const casualtyHtml = (p.deceased > 0 || p.injured > 0)
        ? `<div style="display:flex;gap:8px;margin-top:6px;font-size:11px">` +
          (p.deceased > 0 ? `<span style="color:#c53030;font-weight:700">${p.deceased} deceased</span>` : '') +
          (p.injured > 0 ? `<span style="color:#ed8936;font-weight:700">${p.injured} injured</span>` : '') +
          `</div>` : '';

      if (hoverPopupRef.current) { hoverPopupRef.current.remove(); hoverPopupRef.current = null; }
      if (popupRef.current) popupRef.current.remove();

      popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '300px' })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:var(--font-body);padding:6px 2px">` +
          `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${escapeHtml(String(p.moduleColour))}">${escapeHtml(String(p.moduleLabel))}</div>` +
          `<div style="font-size:13px;font-weight:600;color:#1a1a1a;margin:3px 0 4px">${escapeHtml(String(p.title))}</div>` +
          `<div style="display:flex;gap:8px;font-size:11px;color:#555">` +
          `<span style="padding:1px 6px;border-radius:3px;background:${escapeHtml(String(p.severityColour))}22;color:${escapeHtml(String(p.severityColour))};font-weight:600">${escapeHtml(String(p.severityLabel))}</span>` +
          `<span>${escapeHtml(String(p.town))}, ${escapeHtml(String(p.province))}</span>` +
          `</div>` +
          casualtyHtml +
          `<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">` +
          `<a href="${import.meta.env.BASE_URL}incident/${escapeHtml(String(p.id))}" style="font-size:11px;color:#2563eb;text-decoration:none;font-weight:600">View full details →</a>` +
          `<a href="${import.meta.env.BASE_URL}incident/${escapeHtml(String(p.id))}#correct" class="popup-correction-link" style="font-size:10px;color:#ef4444;text-decoration:none;font-weight:700;border:1px solid #ef444466;padding:2px 8px;border-radius:3px;letter-spacing:.03em">Submit Correction</a>` +
          `</div>` +
          `</div>`,
        )
        .addTo(map);
    });

    map.on('mouseenter', INCIDENTS_LAYER, (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (measureRef.current.active) return;
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features?.[0];
      if (!feature?.properties) return;
      const p = feature.properties;
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      if (hoverPopupRef.current) hoverPopupRef.current.remove();
      hoverPopupRef.current = new maplibregl.Popup({
        offset: 12, closeButton: false, closeOnClick: false, maxWidth: '260px',
        className: 'hover-tooltip',
      })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:var(--font-sans);padding:4px 2px">` +
          `<div style="font-size:12px;font-weight:600;margin-bottom:3px">${escapeHtml(String(p.title))}</div>` +
          `<div style="font-size:10px;color:#888;margin-bottom:4px">` +
          `${escapeHtml(String(p.dateOccurred || 'Date unknown'))} &bull; ${escapeHtml(String(p.town))}, ${escapeHtml(String(p.province))}` +
          `</div>` +
          `<span style="display:inline-block;padding:1px 5px;border-radius:2px;font-size:9px;font-weight:600;letter-spacing:.04em;` +
          `background:${escapeHtml(String(p.moduleColour))}22;color:${escapeHtml(String(p.moduleColour))};` +
          `border:1px solid ${escapeHtml(String(p.moduleColour))}40">${escapeHtml(String(p.moduleLabel).toUpperCase())}</span>` +
          `<span style="margin-left:4px;display:inline-block;padding:1px 5px;border-radius:2px;font-size:9px;font-weight:600;` +
          `background:${escapeHtml(String(p.severityColour))}22;color:${escapeHtml(String(p.severityColour))}">${escapeHtml(String(p.severityLabel))}</span>` +
          `</div>`,
        )
        .addTo(map);
    });
    map.on('mouseleave', INCIDENTS_LAYER, () => {
      if (!measureRef.current.active) map.getCanvas().style.cursor = '';
      if (hoverPopupRef.current) { hoverPopupRef.current.remove(); hoverPopupRef.current = null; }
    });

    // Resize observer for container changes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => map.resize());
    });
    ro.observe(containerRef.current);

    return () => {
      stopWatchdog();
      ro.disconnect();
      if (popupRef.current) popupRef.current.remove();
      if (hoverPopupRef.current) hoverPopupRef.current.remove();
      map.remove();
      mapRef.current = null;
      appliedStyleKeyRef.current = null;
      appliedEventsRef.current = null;
      appliedIncidentsRef.current = null;
      // Reset the state alongside the ref. Resetting only the ref lets the badge
      // keep reading teal "N incidents on map" after a teardown while no layer
      // exists — the transition guard in syncMapContent would never re-fire,
      // and the badge is the primary diagnostic for exactly this bug class.
      layersReadyRef.current = false;
      setLayersReady(false);
      deckOverlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // deck.gl overlay (Enhanced / Cinematic tiers)
  // ------------------------------------------------------------------
  const tryAddDeckOverlay = useCallback(
    (map: maplibregl.Map) => {
      if (renderingTier === 'essential') return;
      if (deckOverlayRef.current) return;

      // Dynamic import — deck.gl may not be available in every environment
      (async () => {
        try {
          const [{ MapboxOverlay }, { ScatterplotLayer }] = await Promise.all([
            import('@deck.gl/mapbox'),
            import('@deck.gl/layers'),
          ]);

          const visibleEvents = events.filter((evt) => {
            const ts = evt.timestamp instanceof Date ? evt.timestamp : new Date(evt.timestamp);
            return ts.getTime() <= currentTime.getTime();
          });

          const overlay = new MapboxOverlay({
            layers: [
              new ScatterplotLayer({
                id: 'deck-events-scatter',
                data: visibleEvents,
                getPosition: (d: IntelligenceEvent) => [
                  d.location.longitude,
                  d.location.latitude,
                ],
                getRadius: (d: IntelligenceEvent) =>
                  2000 + (d.confidence.overall / 100) * 8000,
                getFillColor: (d: IntelligenceEvent) => {
                  const hex = EVENT_TYPE_COLORS[d.type] ?? '#6366f1';
                  return hexToRgba(hex, 100);
                },
                radiusUnits: 'meters' as const,
                pickable: true,
                opacity: 0.4,
                stroked: false,
              }),
            ],
          });

          map.addControl(overlay as unknown as maplibregl.IControl);
          deckOverlayRef.current = overlay;
          console.info('[Map] deck.gl overlay added');
        } catch (err) {
          console.warn('[Map] deck.gl overlay unavailable:', err);
        }
      })();
    },
    [renderingTier, events, currentTime],
  );

  // Stable handle: the init effect has [] deps, so calling tryAddDeckOverlay
  // directly would pin the mount-time closure and a later renderingTier upgrade
  // would never create the overlay.
  const tryAddDeckOverlayRef = useRef(tryAddDeckOverlay);
  tryAddDeckOverlayRef.current = tryAddDeckOverlay;

  // ------------------------------------------------------------------
  // Style change effect — uses setStyle() then re-adds custom layers
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Per-map-instance guard. Survives StrictMode's unmount/remount because
    // the init effect resets appliedStyleKeyRef for every new Map.
    if (appliedStyleKeyRef.current === activeStyle) return;
    appliedStyleKeyRef.current = activeStyle;

    console.info('[Map] basemap switch ->', activeStyle);
    setBasemapError(null);

    const is3D = activeStyle === '3d';
    if (!is3D) disable3D(map);

    const canvas = map.getCanvas();
    canvas.style.transition = 'opacity 250ms ease';
    canvas.style.opacity = '0.15';

    // setStyle destroys every custom source/layer.
    appliedEventsRef.current = null;
    appliedIncidentsRef.current = null;
    map.setStyle(getBasemapStyle(activeStyle));
    map.triggerRepaint();

    const showCanvas = () => {
      canvas.style.opacity = '1';
      setTimeout(() => { canvas.style.transition = ''; }, 300);
    };
    const failsafe = setTimeout(showCanvas, 3000);

    // Terrain and roads used to hang off map.once('idle') alone — the same dead
    // trigger that stranded the incident layers. Drive them from styledata and a
    // self-clearing poll as well, and never let a throw escape into MapLibre's
    // event dispatch (which would abort before showCanvas and leave the canvas
    // stuck at 15% opacity until the failsafe).
    let tries = 0;
    let settled = false;
    const reAdd = () => {
      if (settled) return;
      requestSyncRef.current();
      addMeasureLayers(map);
      if (measureRef.current.points.length > 0) updateMeasureGeometry(map, measureRef.current.points);
      if (is3D) {
        try { enable3D(map); } catch (err) { console.warn('[Map] enable3D failed:', err); }
      }
      let applied = false;
      try {
        applied = applyRoads(map, activeStyle, showRoadsRef.current);
      } catch (err) {
        console.warn('[Map] applyRoads failed:', err);
      }
      if (!applied && tries < 12) { tries += 1; return; }
      settled = true;
      clearTimeout(failsafe);
      showCanvas();
    };

    map.on('idle', reAdd);
    map.on('styledata', reAdd);
    const poll = setInterval(() => {
      if (settled) { clearInterval(poll); return; }
      reAdd();
    }, 400);
    const pollStop = setTimeout(() => clearInterval(poll), 20000);

    return () => {
      settled = true;
      map.off('idle', reAdd);
      map.off('styledata', reAdd);
      clearInterval(poll);
      clearTimeout(pollStop);
      clearTimeout(failsafe);
    };
  }, [activeStyle, addMeasureLayers, updateMeasureGeometry, enable3D, disable3D, applyRoads]);

  // ------------------------------------------------------------------
  // Roads toggle
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Don't gate on isStyleLoaded()/idle — both have been observed permanently
    // false while the style is otherwise usable. Attempt immediately, then retry
    // from styledata plus a self-clearing poll until applyRoads reports success.
    let settled = false;
    const attempt = () => {
      if (settled) return;
      try {
        if (applyRoads(map, activeStyle, showRoads)) settled = true;
      } catch (err) {
        console.warn('[Map] roads toggle failed:', err);
      }
    };

    attempt();
    map.on('styledata', attempt);
    const poll = setInterval(() => {
      if (settled) { clearInterval(poll); return; }
      attempt();
    }, 400);
    const pollStop = setTimeout(() => clearInterval(poll), 20000);

    return () => {
      settled = true;
      map.off('styledata', attempt);
      clearInterval(poll);
      clearTimeout(pollStop);
    };
  }, [showRoads, activeStyle, applyRoads]);

  // ------------------------------------------------------------------
  // 3D hint overlay
  // ------------------------------------------------------------------
  useEffect(() => {
    if (activeStyle !== '3d') { setShow3DHint(false); return; }
    setShow3DHint(true);
    const t = setTimeout(() => setShow3DHint(false), 7000);
    return () => clearTimeout(t);
  }, [activeStyle]);

  // ------------------------------------------------------------------
  // Update GeoJSON data when events or currentTime change
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // syncMapContent owns every events/incidents source, layer and setData call.
    requestSyncRef.current();

    // Update deck.gl overlay if present
    if (deckOverlayRef.current && renderingTier !== 'essential') {
      (async () => {
        try {
          const { ScatterplotLayer } = await import('@deck.gl/layers');

          const visibleEvents = events.filter((evt) => {
            const ts = evt.timestamp instanceof Date ? evt.timestamp : new Date(evt.timestamp);
            return ts.getTime() <= currentTime.getTime();
          });

          const overlay = deckOverlayRef.current as { setProps: (p: unknown) => void };
          overlay.setProps({
            layers: [
              new ScatterplotLayer({
                id: 'deck-events-scatter',
                data: visibleEvents,
                getPosition: (d: IntelligenceEvent) => [
                  d.location.longitude,
                  d.location.latitude,
                ],
                getRadius: (d: IntelligenceEvent) =>
                  2000 + (d.confidence.overall / 100) * 8000,
                getFillColor: (d: IntelligenceEvent) => {
                  const hex = EVENT_TYPE_COLORS[d.type] ?? '#6366f1';
                  return hexToRgba(hex, 100);
                },
                radiusUnits: 'meters' as const,
                pickable: true,
                opacity: 0.4,
                stroked: false,
              }),
            ],
          });
        } catch (err) {
          console.warn('[Map] deck.gl overlay update failed:', err);
        }
      })();
    }
  }, [geojson, events, currentTime, renderingTier]);

  // ------------------------------------------------------------------
  // Incidents data changed — hand off to the single sync routine.
  // The self-clearing watchdog inside requestSync plus the load/styledata/idle
  // listeners registered once in the init effect drive it to completion.
  // ------------------------------------------------------------------
  useEffect(() => {
    requestSync();
  }, [incidentsGeoJson, requestSync]);

  // ------------------------------------------------------------------
  // Fly to selected event when selectedEventId changes externally
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedEventId) return;

    const event = events.find((e) => e.id === selectedEventId);
    if (!event) return;

    map.flyTo({
      center: [event.location.longitude, event.location.latitude],
      zoom: 10,
      duration: 1500,
      essential: true,
    });
  }, [selectedEventId, events]);

  // ------------------------------------------------------------------
  // Fly to explicit center/zoom (used by BriefView chapters)
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCenter) return;
    map.flyTo({
      center: flyToCenter,
      zoom: flyToZoom ?? 6,
      duration: 2000,
      essential: true,
    });
  }, [flyToCenter, flyToZoom]);

  // ------------------------------------------------------------------
  // Address search radius circle overlay
  // ------------------------------------------------------------------
  const searchLocation = useAppStore((s) => s.searchLocation);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SRC = 'search-radius-src';
    const FILL = 'search-radius-fill';
    const LINE = 'search-radius-line';

    const removeCircle = () => {
      try { if (map.getLayer(LINE)) map.removeLayer(LINE); } catch {}
      try { if (map.getLayer(FILL)) map.removeLayer(FILL); } catch {}
      try { if (map.getSource(SRC)) map.removeSource(SRC); } catch {}
    };

    if (!searchLocation) { removeCircle(); return; }

    const steps = 64;
    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const dx = searchLocation.radiusKm * Math.cos(angle);
      const dy = searchLocation.radiusKm * Math.sin(angle);
      const lat = searchLocation.lat + (dy / 111.32);
      const lng = searchLocation.lng + (dx / (111.32 * Math.cos((searchLocation.lat * Math.PI) / 180)));
      coords.push([lng, lat]);
    }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      }],
    };

    const apply = () => {
      removeCircle();
      map.addSource(SRC, { type: 'geojson', data: geojson });
      map.addLayer({ id: FILL, type: 'fill', source: SRC, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.08 } });
      map.addLayer({ id: LINE, type: 'line', source: SRC, paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [3, 2] } });
    };

    if (map.isStyleLoaded()) { apply(); }
    else { map.once('styledata', apply); }

    map.flyTo({ center: [searchLocation.lng, searchLocation.lat], zoom: Math.max(8, 13 - Math.log2(searchLocation.radiusKm / 5)), duration: 1500 });

    const marker = new maplibregl.Marker({ color: '#3b82f6' })
      .setLngLat([searchLocation.lng, searchLocation.lat])
      .addTo(map);

    return () => { removeCircle(); marker.remove(); };
  }, [searchLocation]);

  // ------------------------------------------------------------------
  // Measure toggle / undo helpers
  // ------------------------------------------------------------------
  function toggleMeasure() {
    if (measure.active) { clearMeasure(); }
    else {
      setMeasure({ active: true, points: [], totalKm: 0 });
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'crosshair';
    }
  }

  function undoLastPoint() {
    if (measure.points.length === 0) return;
    const newPoints = measure.points.slice(0, -1);
    let totalKm = 0;
    for (let i = 1; i < newPoints.length; i++) {
      totalKm += haversineKm(newPoints[i - 1]![1], newPoints[i - 1]![0], newPoints[i]![1], newPoints[i]![0]);
    }
    setMeasure({ active: true, points: newPoints, totalKm });
    if (mapRef.current) updateMeasureGeometry(mapRef.current, newPoints);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div
      data-event-density={visibleCount > 50 ? 'high' : 'normal'}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--surface-0)',
      }}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {activeStyle === '3d' && show3DHint && (
        <div className="map-3d-hint" role="status">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" />
          </svg>
          Right-click + drag to tilt &amp; rotate &middot; scroll to zoom
          <button className="map-3d-hint-close" onClick={() => setShow3DHint(false)} title="Dismiss">&times;</button>
        </div>
      )}

      <div className="map-top-controls">
        {measure.active && (
          <div className="measure-panel">
            <div className="measure-header">
              <span className="measure-title">Measure distance</span>
              <button className="measure-close" onClick={clearMeasure} title="Close measure tool">&times;</button>
            </div>
            <ol className="measure-steps">
              <li>Click a point on the map to start.</li>
              <li>Keep clicking to add legs — the total updates as you go.</li>
              <li><strong>Undo</strong> removes the last point, <strong>Clear</strong> starts over.</li>
            </ol>
            <div className="measure-value">
              {measure.points.length < 2
                ? (measure.points.length === 1 ? 'Click a second point to measure...' : 'Click your first point on the map...')
                : `Total distance: ${formatDistance(measure.totalKm)}`}
            </div>
            {measure.points.length > 0 && (
              <div className="measure-actions">
                <button className="measure-action-btn" onClick={undoLastPoint}>Undo</button>
                <button className="measure-action-btn" onClick={clearMeasure}>Clear</button>
              </div>
            )}
            <div className="measure-points-count">{measure.points.length} point{measure.points.length !== 1 ? 's' : ''} placed</div>
          </div>
        )}

        <div className="map-controls-box">
          <button className={`map-style-btn measure-btn${measure.active ? ' active' : ''}`} onClick={toggleMeasure} title={measure.active ? 'Stop measuring' : 'Measure distance between points'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 22L22 2" /><path d="M6 18l2-2" /><path d="M10 14l2-2" /><path d="M14 10l2-2" /><path d="M18 6l2-2" />
            </svg>
            Measure
          </button>
          <span className="map-style-divider" />
          <div className="map-style-group">
            {(Object.keys(STYLE_LABELS) as MapStyleKey[]).map(key => (
              <button
                key={key}
                className={`map-style-btn${activeStyle === key ? ' active' : ''}${key === '3d' ? ' map-style-btn-3d' : ''}`}
                onClick={() => setActiveStyle(key)}
                title={key === '3d' ? '3D terrain view (tilt & rotate)' : `${STYLE_LABELS[key]} basemap`}
              >
                {STYLE_LABELS[key] ?? key}
              </button>
            ))}
          </div>
          <span className="map-style-divider" />
          <button
            className={`map-style-btn roads-btn${showRoads ? ' active' : ''}`}
            onClick={() => setShowRoads(v => !v)}
            title={showRoads ? 'Hide road network' : 'Show road network'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19l4-14" /><path d="M20 19l-4-14" /><path d="M12 6v2" /><path d="M12 11v2" /><path d="M12 16v2" />
            </svg>
            Roads
          </button>
        </div>
      </div>

      {/* Basemap failure banner — a broken basemap must announce itself rather
          than silently rendering as an empty background. */}
      {basemapError && (
        <div style={{
          position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
          zIndex: 25, background: 'rgba(197, 48, 48, 0.94)', color: '#fff',
          fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 4,
          maxWidth: '80%', textAlign: 'center',
        }}>
          {basemapError}
        </div>
      )}

      {/* Three different reasons for an empty map, three different messages.
          A blank map that says nothing has cost this project several rounds, so
          every branch below names the cause and, where one exists, offers the
          one-click way out. */}
      {layersReady && markerCount === 0 && !incidentsLoading && (
        <div className="map-empty-state" role="status">
          {allIncidents.length === 0 && awaitingReview > 0 ? (
            <>
              <div className="map-empty-title">
                Nothing published — {awaitingReview} record{awaitingReview === 1 ? '' : 's'} awaiting your review
              </div>
              <div className="map-empty-text">
                The data loaded. It is held back until you confirm it, because every imported
                record has at least one machine-derived field. Use the amber bar above the map
                to release it.
              </div>
            </>
          ) : allIncidents.length === 0 ? (
            <>
              <div className="map-empty-title">No incident data loaded</div>
              <div className="map-empty-text">
                Nothing was returned by the API and nothing has been imported. This is an empty
                dataset — not a filter, and not a map failure.
              </div>
            </>
          ) : filterActive ? (
            <>
              <div className="map-empty-title">No incidents in {filterLabel}</div>
              <div className="map-empty-text">
                {outsideWindowCount} record{outsideWindowCount === 1 ? ' falls' : 's fall'} outside this window
                {undatedCount > 0 && (
                  undatedIncluded
                    ? `, and ${undatedCount} ${undatedCount === 1 ? 'has' : 'have'} no stated date (currently included)`
                    : `, and ${undatedCount} with no stated date ${undatedCount === 1 ? 'is' : 'are'} excluded by your choice`
                )}. {allIncidents.length} record{allIncidents.length === 1 ? '' : 's'} in total
                {mergedCount > 0 && `, after ${mergedCount} duplicate${mergedCount === 1 ? '' : 's'} ${mergedCount === 1 ? 'was' : 'were'} merged away`}.
                {/* Without this, an import that is entirely withheld reads as a
                    date-filter miss and the user re-tunes the window forever. */}
                {awaitingReview > 0 && ` A further ${awaitingReview} imported record${awaitingReview === 1 ? ' is' : 's are'} held back pending review and ${awaitingReview === 1 ? 'is' : 'are'} not in that total — releasing ${awaitingReview === 1 ? 'it' : 'them'} may fill this window.`}
              </div>
              <div className="map-empty-actions">
                <button onClick={() => setTimeFilter({ mode: 'all' })}>Show all time</button>
                {undatedCount > 0 && !undatedIncluded && (
                  <button onClick={() => setIncludeUndated(true)}>
                    Include {undatedCount} undated
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="map-empty-title">
                {allIncidents.length} record{allIncidents.length === 1 ? '' : 's'}, none with a resolvable location
              </div>
              <div className="map-empty-text">
                No time filter is active. These records have no coordinates, town or province that
                could be resolved to a point, so they cannot be plotted. They are still counted in
                the dashboard totals.
              </div>
            </>
          )}
        </div>
      )}

      {/* Marker count badge — diagnostic + user feedback.
          Reports mapped vs unmappable honestly: incidents whose location could
          not be resolved produce no feature, and saying "N incidents on map"
          while silently dropping them is what hid this bug for so long.
          Rendered at ZERO too: unmounting the only on-map diagnostic in exactly
          the failure case is what made the historical failures unreadable. */}
      {(
        <div style={{
          position: 'absolute', bottom: 8, left: 12, zIndex: 20,
          background: layersReady ? 'rgba(56, 178, 172, 0.9)' : 'rgba(197, 48, 48, 0.9)',
          color: '#fff', fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 4,
          // The wrapper must not eat map drags, but the chips below carry the
          // ONLY statement of why records are missing — with pointerEvents
          // 'none' inherited, their title tooltips could never be shown. Each
          // chip re-enables pointer events for itself.
          pointerEvents: 'none',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span>
            {!layersReady
              ? `${incidents.length} incidents pending...`
              : filterActive
                ? `${markerCount} on map · ${filterLabel}`
                : `${markerCount} incidents on map`}
          </span>
          {unmappedCount > 0 && (
            <span
              title={`${unmappedCount} incident(s) have no resolvable location and cannot be plotted. They are still counted in the dashboard totals.`}
              style={{
                background: 'rgba(0,0,0,0.35)', padding: '1px 6px', borderRadius: 3,
                fontWeight: 700, pointerEvents: 'auto', cursor: 'help',
              }}
            >
              {unmappedCount} unmapped
            </span>
          )}
          {mergedCount > 0 && (
            <span
              title={`${mergedCount} record(s) were merged away as duplicates before publishing — another record carried the same description, date and place. They are not counted in any total on this screen.`}
              style={{
                background: 'rgba(0,0,0,0.35)', padding: '1px 6px', borderRadius: 3,
                fontWeight: 700, pointerEvents: 'auto', cursor: 'help',
              }}
            >
              {mergedCount} merged
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}
