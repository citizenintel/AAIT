import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre-setup';
import { formatDistanceToNow } from 'date-fns';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '@/data/mock-incidents';
import type { MockIncident } from '@/data/mock-incidents';
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
// Map styles — all inline (no remote style JSON fetches)
// ---------------------------------------------------------------------------

function satelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8 as const,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        maxzoom: 18,
      },
      'carto-labels': {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
        attribution: '&copy; CARTO',
        maxzoom: 18,
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0a1a2e' } },
      { id: 'satellite-tiles', type: 'raster', source: 'esri-satellite', paint: { 'raster-fade-duration': 300 } },
      { id: 'label-tiles', type: 'raster', source: 'carto-labels', paint: { 'raster-fade-duration': 300 } },
    ],
  } satisfies maplibregl.StyleSpecification;
}

const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8 as const,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      maxzoom: 18,
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#111113' } },
    { id: 'dark-tiles', type: 'raster', source: 'carto-dark', paint: { 'raster-fade-duration': 300 } },
  ],
};

const LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8 as const,
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      maxzoom: 18,
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#f2efe9' } },
    { id: 'light-tiles', type: 'raster', source: 'carto-light', paint: { 'raster-fade-duration': 300 } },
  ],
};

const MAP_STYLES: Record<string, maplibregl.StyleSpecification> = {
  standard: DARK_STYLE,
  light: LIGHT_STYLE,
  terrain: {
    version: 8 as const,
    sources: {
      'opentopomap': {
        type: 'raster',
        tiles: [
          'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenTopoMap (CC-BY-SA)',
        maxzoom: 17,
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#d4c6a1' } },
      { id: 'topo-tiles', type: 'raster', source: 'opentopomap', paint: { 'raster-fade-duration': 300 } },
    ],
  } satisfies maplibregl.StyleSpecification,
  satellite: satelliteStyle(),
  '3d': satelliteStyle(),
};

const STYLE_LABELS: Record<string, string> = {
  standard: 'Standard', light: 'Light', terrain: 'Terrain', satellite: 'Satellite', '3d': '3D',
};

type MapStyleKey = keyof typeof MAP_STYLES;

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
  const features: GeoJSON.Feature[] = incidents.map((inc) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [inc.lng, inc.lat] },
    properties: {
      id: inc.id,
      title: inc.title,
      module: inc.module,
      severity: inc.severity,
      verification: inc.verification,
      town: inc.town,
      province: inc.province,
      moduleColour: MODULE_META[inc.module].colour,
      severityColour: SEVERITY_META[inc.severity].colour,
      moduleLabel: MODULE_META[inc.module].label,
      severityLabel: SEVERITY_META[inc.severity].label,
      dateOccurred: inc.dateOccurred,
      deceased: inc.casualties?.deceased ?? 0,
      injured: inc.casualties?.injured ?? 0,
      isSynthetic: inc.isSynthetic,
    },
  }));
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
  const incidentsGeoJsonRef = useRef(incidentsGeoJson);
  incidentsGeoJsonRef.current = incidentsGeoJson;

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
      if (map.getSource(EVENTS_SOURCE)) return;

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

      // Mock incidents layer — module-coloured markers with severity ring
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
      style: DARK_STYLE,
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
    });

    // Force repaints when raster tiles finish loading (fixes blank tile boxes in MapLibre v6)
    map.on('sourcedata', (e: maplibregl.MapSourceDataEvent) => {
      if (e.isSourceLoaded && e.dataType === 'source') {
        map.triggerRepaint();
      }
    });

    // If the style was swapped (fallback or user-switched), re-add layers
    map.on('styledata', () => {
      if (map.isStyleLoaded() && !map.getSource(EVENTS_SOURCE)) {
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

    // Resize observer for container changes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => map.resize());
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
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
  // Style change effect (skips initial mount — handled by init effect)
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!didMountRef.current) return;

    const is3D = activeStyle === '3d';
    if (!is3D) disable3D(map);

    const canvas = map.getCanvas();
    canvas.style.transition = 'opacity 250ms ease';
    canvas.style.opacity = '0.15';

    map.setStyle(MAP_STYLES[activeStyle]!);

    let tries = 0;
    const reAdd = () => {
      addSourceAndLayer(map);
      addMeasureLayers(map);
      if (measureRef.current.points.length > 0) updateMeasureGeometry(map, measureRef.current.points);
      if (is3D) enable3D(map);
      const applied = applyRoads(map, activeStyle, showRoadsRef.current);
      if (!applied && tries < 6) { tries += 1; map.once('idle', reAdd); return; }
      map.triggerRepaint();
      requestAnimationFrame(() => {
        canvas.style.opacity = '1';
        setTimeout(() => { canvas.style.transition = ''; }, 300);
      });
    };
    map.once('idle', reAdd);

    // Failsafe: if idle never fires within 4s, force canvas visible
    const failsafe = setTimeout(() => {
      if (canvas.style.opacity !== '1') {
        canvas.style.opacity = '1';
        canvas.style.transition = '';
        addSourceAndLayer(map);
        addMeasureLayers(map);
        if (is3D) enable3D(map);
      }
    }, 4000);

    return () => { map.off('idle', reAdd); clearTimeout(failsafe); };
  }, [activeStyle, addSourceAndLayer, addMeasureLayers, updateMeasureGeometry, enable3D, disable3D, applyRoads]);

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

    const doUpdate = () => {
      try {
        const source = map.getSource(INCIDENTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(incidentsGeoJson);
      } catch { /* map not ready */ }
    };

    // Try immediately — works when map is already loaded
    doUpdate();

    // Also retry after map becomes idle (covers all timing races:
    // store hydration before map load, HMR re-renders, style changes)
    const onIdle = () => doUpdate();
    map.once('idle', onIdle);
    return () => { map.off('idle', onIdle); };
  }, [incidentsGeoJson]);

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
            {(Object.keys(MAP_STYLES) as MapStyleKey[]).map(key => (
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
