import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre-setup';
import { formatDistanceToNow } from 'date-fns';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '@/data/mock-incidents';
import type { MockIncident } from '@/data/mock-incidents';
import { deconflictCoordinates } from '@/lib/utils/map-deconflict';
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


// ---------------------------------------------------------------------------
// Map basemaps — all sources added at init, switching toggles visibility
// ---------------------------------------------------------------------------

const BASEMAP_BG_COLORS: Record<string, string> = {
  standard: '#111113',
  light: '#f2efe9',
  terrain: '#d4c6a1',
  satellite: '#0a1a2e',
  '3d': '#0a1a2e',
};

const BG_LAYER = 'basemap-bg';

const BASEMAP_KEYS = ['standard', 'light', 'terrain', 'satellite'] as const;

const INITIAL_STYLE: maplibregl.StyleSpecification = {
  version: 8 as const,
  sources: {
    'src-standard': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      maxzoom: 18,
    },
    'src-light': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      maxzoom: 18,
    },
    'src-terrain': {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 17,
    },
    'src-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
    },
    'src-sat-labels': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      maxzoom: 18,
    },
  },
  layers: [
    { id: BG_LAYER, type: 'background', paint: { 'background-color': '#111113' } },
    { id: 'lyr-standard', type: 'raster', source: 'src-standard', layout: { visibility: 'visible' }, paint: { 'raster-fade-duration': 300 } },
    { id: 'lyr-light', type: 'raster', source: 'src-light', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 300 } },
    { id: 'lyr-terrain', type: 'raster', source: 'src-terrain', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 300 } },
    { id: 'lyr-satellite', type: 'raster', source: 'src-satellite', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 300 } },
    { id: 'lyr-sat-labels', type: 'raster', source: 'src-sat-labels', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 300 } },
  ],
};

function swapBasemap(map: maplibregl.Map, key: string) {
  const bgColor = BASEMAP_BG_COLORS[key] ?? '#111113';
  if (map.getLayer(BG_LAYER)) {
    map.setPaintProperty(BG_LAYER, 'background-color', bgColor);
  }

  for (const k of BASEMAP_KEYS) {
    const layerId = `lyr-${k}`;
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', k === key || (key === '3d' && k === 'satellite') ? 'visible' : 'none');
    }
  }

  const showLabels = key === 'satellite' || key === '3d';
  if (map.getLayer('lyr-sat-labels')) {
    map.setLayoutProperty('lyr-sat-labels', 'visibility', showLabels ? 'visible' : 'none');
  }

  map.triggerRepaint();
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
// Province centroids — fallback geocoding for incidents with missing coords
// ---------------------------------------------------------------------------

const PROVINCE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Gauteng': { lat: -26.27, lng: 28.11 },
  'Limpopo': { lat: -23.40, lng: 29.42 },
  'Mpumalanga': { lat: -25.57, lng: 30.30 },
  'North West': { lat: -26.66, lng: 25.28 },
  'Free State': { lat: -29.08, lng: 26.15 },
  'KwaZulu-Natal': { lat: -29.01, lng: 30.29 },
  'Eastern Cape': { lat: -32.00, lng: 26.50 },
  'Western Cape': { lat: -33.23, lng: 19.32 },
  'Northern Cape': { lat: -29.10, lng: 21.25 },
};

function resolveCoords(inc: MockIncident): { lng: number; lat: number } | null {
  if (inc.lng != null && inc.lat != null && !(inc.lng === 0 && inc.lat === 0)) {
    return { lng: inc.lng, lat: inc.lat };
  }
  const provKey = Object.keys(PROVINCE_CENTROIDS).find(
    k => k.toLowerCase() === (inc.province ?? '').toLowerCase(),
  );
  if (provKey) {
    const c = PROVINCE_CENTROIDS[provKey]!;
    const jitter = () => (Math.random() - 0.5) * 0.5;
    return { lat: c.lat + jitter(), lng: c.lng + jitter() };
  }
  if (inc.province || inc.town) {
    const jitter = () => (Math.random() - 0.5) * 4;
    return { lat: -28.5 + jitter(), lng: 25.5 + jitter() };
  }
  return null;
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
  const coordMap = deconflictCoordinates(incidents);
  const features: GeoJSON.Feature[] = [];
  for (const inc of incidents) {
    const baseCoords = resolveCoords(inc);
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
  const deckOverlayRef = useRef<unknown>(null);
  const didMountRef = useRef(false);
  const incidentMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Style / control state
  const [activeStyle, setActiveStyle] = useState<MapStyleKey>('standard');
  const [measure, setMeasure] = useState<MeasureState>({ active: false, points: [], totalKm: 0 });
  const [showRoads, setShowRoads] = useState(false);
  const [show3DHint, setShow3DHint] = useState(false);
  const [markerCount, setMarkerCount] = useState(0);

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
  const incidentsGeoJsonRef = useRef(incidentsGeoJson);
  incidentsGeoJsonRef.current = incidentsGeoJson;

  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;

  const visibleCount = geojson.features.length;

  // ------------------------------------------------------------------
  // Build the match expression for circle-color
  // ------------------------------------------------------------------
  const colorMatchExpr: maplibregl.ExpressionSpecification = [
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

  // ------------------------------------------------------------------
  // Add all custom sources + layers to the map
  // ------------------------------------------------------------------
  const addSourceAndLayer = useCallback(
    (map: maplibregl.Map) => {
      if (!map.getSource(EVENTS_SOURCE)) {
        map.addSource(EVENTS_SOURCE, {
          type: 'geojson',
          data: geojsonRef.current,
        });

        map.addLayer({
          id: EVENTS_LAYER,
          type: 'circle',
          source: EVENTS_SOURCE,
          paint: {
            'circle-color': colorMatchExpr,
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'confidence'],
              0, 4,
              100, 12,
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.15)',
          },
        });
      }

      if (!map.getSource(INCIDENTS_SOURCE)) {
        map.addSource(INCIDENTS_SOURCE, { type: 'geojson', data: incidentsGeoJsonRef.current });

        // Outer pulse ring for critical incidents
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

        // Main incident circles
        map.addLayer({
          id: INCIDENTS_LAYER,
          type: 'circle',
          source: INCIDENTS_SOURCE,
          paint: {
            'circle-color': ['get', 'moduleColour'],
            'circle-radius': [
              'match', ['get', 'severity'],
              'critical', 9,
              'high', 7,
              'medium', 6,
              'low', 5,
              5,
            ],
            'circle-opacity': 0.9,
            'circle-stroke-width': [
              'match', ['get', 'severity'],
              'critical', 3,
              'high', 2,
              2,
            ],
            'circle-stroke-color': ['get', 'severityColour'],
          },
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ------------------------------------------------------------------
  // Reusable marker placement — called from effect AND map load callback
  // ------------------------------------------------------------------
  const placeIncidentMarkers = useCallback((map: maplibregl.Map) => {
    try {
      for (const m of incidentMarkersRef.current) m.remove();
      incidentMarkersRef.current = [];

      const incs = incidentsRef.current;
      const coordMap = deconflictCoordinates(incs);
      const DEFAULT_MODULE = MODULE_META.ait;
      const DEFAULT_SEVERITY = SEVERITY_META.medium;
      let placed = 0;
      let skipped = 0;

      for (const inc of incs) {
        const baseCoords = resolveCoords(inc);
        if (!baseCoords) { skipped++; continue; }
        const coords = coordMap.get(inc.id) ?? baseCoords;

        const modMeta = MODULE_META[inc.module as keyof typeof MODULE_META] ?? DEFAULT_MODULE;
        const sevMeta = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META] ?? DEFAULT_SEVERITY;
        const size = inc.severity === 'critical' ? 14 : inc.severity === 'high' ? 11 : 9;

        const el = document.createElement('div');
        el.className = 'incident-marker';
        el.style.cssText = `width:${size}px;height:${size}px;background:${modMeta.colour};border:2px solid ${sevMeta.colour};border-radius:50%;cursor:pointer;box-shadow:0 0 4px rgba(0,0,0,0.5);z-index:10;`;
        el.title = `${inc.title}\n${inc.province} · ${inc.dateOccurred}`;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const existing = popupRef.current;
          if (existing) existing.remove();
          const dead = inc.casualties?.deceased ?? 0;
          const hurt = inc.casualties?.injured ?? 0;
          const casualtyLine = (dead > 0 || hurt > 0)
            ? `<div style="margin-top:4px;font-size:11px;color:#e53e3e">${dead > 0 ? dead + ' deceased' : ''}${dead > 0 && hurt > 0 ? ' · ' : ''}${hurt > 0 ? hurt + ' injured' : ''}</div>`
            : '';
          const popup = new maplibregl.Popup({ offset: 10, maxWidth: '340px', closeButton: true, className: 'incident-popup' })
            .setLngLat([coords.lng, coords.lat])
            .setHTML(
              `<div style="font-size:12px;color:#1a1a1a"><div style="font-weight:700;margin-bottom:4px;color:#111">${inc.title}</div>` +
              `<div style="color:#555;font-size:11px">${modMeta.label} · ${sevMeta.label} · ${inc.province || ''}</div>` +
              `<div style="color:#555;font-size:11px">${inc.dateOccurred || ''} · ${inc.town || ''}</div>` +
              `${casualtyLine}` +
              `${inc.summary ? '<div style="margin-top:6px;font-size:11px;color:#333;max-height:180px;overflow-y:auto;line-height:1.5;white-space:pre-wrap">' + inc.summary + '</div>' : ''}</div>`,
            )
            .addTo(map);
          popupRef.current = popup;
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([coords.lng, coords.lat])
          .addTo(map);
        incidentMarkersRef.current.push(marker);
        placed++;
      }

      setMarkerCount(placed);
      console.log(`[IntelligenceMap] Marker render: ${incs.length} incidents, ${placed} placed, ${skipped} skipped`);
      if (placed === 0 && incs.length > 0) {
        console.warn('[IntelligenceMap] Zero markers! Sample:', JSON.stringify(incs[0], null, 2));
      }
    } catch (err) {
      console.error('[IntelligenceMap] Marker creation failed:', err);
    }
  }, []);

  // ------------------------------------------------------------------
  // Measure layers
  // ------------------------------------------------------------------
  const addMeasureLayers = useCallback((map: maplibregl.Map) => {
    if (map.getSource(MEASURE_SOURCE)) return;
    map.addSource(MEASURE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: MEASURE_LINE_LAYER, type: 'line', source: MEASURE_SOURCE,
      filter: ['==', '$type', 'LineString'],
      paint: { 'line-color': '#c9a84c', 'line-width': 2.5, 'line-dasharray': [3, 2] },
    });
    map.addLayer({
      id: MEASURE_POINT_LAYER, type: 'circle', source: MEASURE_SOURCE,
      filter: ['==', '$type', 'Point'],
      paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#c9a84c', 'circle-stroke-width': 2 },
    });
  }, []);

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
    if (map.getZoom() < 7) {
      map.flyTo({ center: [18.45, -33.96], zoom: 11, pitch: 76, bearing: -30, duration: 2800, essential: true });
    } else {
      map.easeTo({ pitch: 78, duration: 1000 });
    }
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
      style: INITIAL_STYLE,
      center: [25.5, -28.0],
      zoom: 5.5,
      minZoom: 3,
      maxZoom: 18,
      maxPitch: 85,
      attributionControl: false,
    });

    map.on('load', () => {
      addSourceAndLayer(map);
      addMeasureLayers(map);
      tryAddDeckOverlay(map);
      didMountRef.current = true;
      // Safety net: place markers here in case the effect fired before map was ready
      if (incidentMarkersRef.current.length === 0 && incidentsRef.current.length > 0) {
        console.log('[IntelligenceMap] Map load: placing markers that missed the effect');
        placeIncidentMarkers(map);
      }
    });

    // Force repaints when raster tiles finish loading (fixes blank tile boxes in MapLibre v6)
    map.on('sourcedata', (e: maplibregl.MapSourceDataEvent) => {
      if (e.isSourceLoaded && e.dataType === 'source') {
        map.triggerRepaint();
      }
    });

    // If custom sources go missing, re-add them
    map.on('styledata', () => {
      if (map.isStyleLoaded() && (!map.getSource(EVENTS_SOURCE) || !map.getSource(INCIDENTS_SOURCE))) {
        addSourceAndLayer(map);
        addMeasureLayers(map);
      }
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
          `<div style="margin-top:8px"><a href="${import.meta.env.BASE_URL}incident/${escapeHtml(String(p.id))}" style="font-size:11px;color:#2563eb;text-decoration:none;font-weight:600">View full details →</a></div>` +
          `</div>`,
        )
        .addTo(map);
    });

    map.on('mouseenter', INCIDENTS_LAYER, () => {
      if (!measureRef.current.active) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', INCIDENTS_LAYER, () => {
      if (!measureRef.current.active) map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;

    // Delayed safety net: re-place markers after hydration likely completes
    const hydrateTimer = setInterval(() => {
      if (incidentsRef.current.length > 0 && incidentMarkersRef.current.length === 0) {
        console.log('[IntelligenceMap] Hydration retry: placing', incidentsRef.current.length, 'markers');
        placeIncidentMarkers(map);
      }
    }, 2000);
    const hydrateTimeout = setTimeout(() => clearInterval(hydrateTimer), 15000);

    // Resize observer for container changes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => map.resize());
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      clearInterval(hydrateTimer);
      clearTimeout(hydrateTimeout);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
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
        } catch {
          // deck.gl not available — Essential rendering only
        }
      })();
    },
    [renderingTier, events, currentTime],
  );

  // ------------------------------------------------------------------
  // Style change effect — swaps basemap tiles without setStyle()
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!didMountRef.current) return;

    const is3D = activeStyle === '3d';
    if (!is3D) disable3D(map);

    swapBasemap(map, activeStyle);

    if (is3D) enable3D(map);
    applyRoads(map, activeStyle, showRoadsRef.current);
  }, [activeStyle, enable3D, disable3D, applyRoads]);

  // ------------------------------------------------------------------
  // Roads toggle
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      applyRoads(map, activeStyle, showRoads);
    } else {
      const h = () => applyRoads(map, activeStyle, showRoads);
      map.once('idle', h);
      return () => { map.off('idle', h); };
    }
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
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(EVENTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }

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
        } catch {
          // deck.gl update failed — silent
        }
      })();
    }
  }, [geojson, events, currentTime, renderingTier]);

  // ------------------------------------------------------------------
  // Update incidents source when incidents change
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let done = false;

    const doUpdate = () => {
      if (done) return;
      try {
        let source = map.getSource(INCIDENTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (!source && map.isStyleLoaded()) {
          addSourceAndLayer(map);
          source = map.getSource(INCIDENTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
        }
        if (source) {
          source.setData(incidentsGeoJson);
          done = true;
        }
      } catch { /* map not ready */ }
    };

    doUpdate();

    const onReady = () => doUpdate();
    if (!map.loaded()) map.once('load', onReady);
    map.on('idle', onReady);
    map.on('sourcedata', onReady);

    // Polling fallback: retry every 500ms for up to 10s in case events were missed
    const interval = setInterval(() => {
      doUpdate();
      if (done) clearInterval(interval);
    }, 500);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      done = true;
      map.off('load', onReady);
      map.off('idle', onReady);
      map.off('sourcedata', onReady);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [incidentsGeoJson]);

  // ------------------------------------------------------------------
  // HTML marker fallback — guaranteed to render regardless of tile/source state
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      console.warn('[IntelligenceMap] Marker effect: map not ready, incidents pending:', incidents.length);
      return;
    }
    placeIncidentMarkers(map);
    return () => {
      for (const m of incidentMarkersRef.current) m.remove();
      incidentMarkersRef.current = [];
    };
  }, [incidents, placeIncidentMarkers]);

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

      {/* Marker count badge — diagnostic + user feedback */}
      {(incidents.length > 0 || markerCount > 0) && (
        <div style={{
          position: 'absolute', bottom: 8, left: 12, zIndex: 20,
          background: markerCount > 0 ? 'rgba(56, 178, 172, 0.9)' : 'rgba(197, 48, 48, 0.9)',
          color: '#fff', fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 4,
          pointerEvents: 'none',
        }}>
          {markerCount > 0
            ? `${markerCount} incidents on map`
            : `${incidents.length} incidents pending...`}
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
