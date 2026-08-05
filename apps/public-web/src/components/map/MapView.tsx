import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre-setup';
import { SEVERITY_META, VERIFICATION_META, MODULE_META, type MockIncident } from '../../data/mock-incidents';
import { useAppStore } from '@/stores/app-store';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { deconflictCoordinates } from '@/lib/utils/map-deconflict';
import { resolveCoords } from '@/lib/utils/sa-coordinates';

// Satellite imagery + place labels. Reused for the flat "Satellite" view and as the
// drape for the "3D" terrain view (a fresh object per key so setStyle always reprocesses).
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

const MAP_STYLES: Record<string, string | maplibregl.StyleSpecification> = {
  standard: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
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

const SA_CENTER: [number, number] = [25.5, -28.0];
const SA_ZOOM = 6.2;

// Free, key-less elevation tiles (AWS Terrain Tiles open dataset, terrarium encoding) for 3D.
const TERRAIN_SOURCE = 'terrain-dem';
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// Roads overlay for raster basemaps: free key-less vector roads from OpenFreeMap
// (OpenMapTiles schema, `transportation` layer, CORS-open), drawn as gold lines with a
// dark casing so they read on both bright imagery and dark terrain.
const ROADS_SOURCE = 'ofm-roads';
const ROADS_TILEJSON = 'https://tiles.openfreemap.org/planet';
const ROADS_LAYER = 'transportation';
const ROADS_CASING = 'roads-casing';
const ROADS_OVERLAY = 'roads-overlay';
// On vector basemaps we toggle the native road layers instead.
const ROAD_LAYER_RE = /road|street|motorway|trunk|primary|secondary|tertiary|highway|bridge|tunnel/i;

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

interface MeasureState {
  active: boolean;
  points: [number, number][];
  totalKm: number;
}

const MEASURE_SOURCE = 'measure-source';
const MEASURE_LINE_LAYER = 'measure-line';
const MEASURE_POINT_LAYER = 'measure-points';

export function MapView() {
  const { incidents } = useIncidentData();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [activeStyle, setActiveStyle] = useState<MapStyleKey>('standard');
  const [measure, setMeasure] = useState<MeasureState>({ active: false, points: [], totalKm: 0 });
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const [showRoads, setShowRoads] = useState(false);
  const showRoadsRef = useRef(showRoads);
  showRoadsRef.current = showRoads;
  const [show3DHint, setShow3DHint] = useState(false);
  const didMount = useRef(false);

  const filters = useAppStore((s) => s.filters);
  const setSelectedIncident = useAppStore((s) => s.setSelectedIncident);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // `=== false` (not `!`) so a module/severity key added after the operator's
      // filter state was persisted defaults to VISIBLE instead of silently
      // vanishing from the map.
      if (filters.modules[inc.module] === false) return false;
      if (!filters.showSynthetic && inc.isSynthetic) return false;
      if (filters.severities[inc.severity] === false) return false;
      // A record whose location could not be resolved has no position to plot.
      // It stays in the dataset (lists, counts) but is never given a made-up one.
      if (!Number.isFinite(inc.lat) || !Number.isFinite(inc.lng)) return false;
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        if (!inc.title.toLowerCase().includes(q) && !inc.summary.toLowerCase().includes(q) && !inc.town.toLowerCase().includes(q) && !inc.province.toLowerCase().includes(q)) return false;
      }
      if (filters.province && inc.province !== filters.province) return false;
      const catKey = inc.category;
      if (Object.keys(filters.categories).length > 0 && filters.categories[catKey] === false) return false;
      return true;
    });
  }, [incidents, filters]);

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

  // 3D terrain: drape the satellite imagery over an elevation model, add an atmospheric
  // sky, and tilt the camera. Reversed cleanly when leaving the 3D view.
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
    // Enter at a low, near-horizontal angle so the relief reads. From the wide national
    // view there's no terrain to see, so fly to the Drakensberg / Lesotho escarpment.
    if (map.getZoom() < 7) {
      map.flyTo({ center: [28.92, -29.55], zoom: 9, pitch: 78, bearing: 18, duration: 2400, essential: true });
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

  // Roads: on vector basemaps toggle the native road layers; on raster basemaps
  // (satellite / terrain / 3D) add or remove a translucent OpenStreetMap overlay.
  // Returns false when a vector basemap's road layers aren't merged in yet (so the
  // caller can retry on a later idle); true once applied or for raster overlays.
  const applyRoads = useCallback((map: maplibregl.Map, styleKey: MapStyleKey, show: boolean): boolean => {
    const isVector = styleKey === 'standard' || styleKey === 'light';
    if (isVector) {
      // vector basemaps already draw roads — just toggle their visibility
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
          id: ROADS_CASING, type: 'line', source: ROADS_SOURCE, 'source-layer': ROADS_LAYER,
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
          id: ROADS_OVERLAY, type: 'line', source: ROADS_SOURCE, 'source-layer': ROADS_LAYER,
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

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[activeStyle]!,
      center: SA_CENTER, zoom: SA_ZOOM, minZoom: 4, maxZoom: 18, maxPitch: 85, attributionControl: false,
    });
    map.setPadding({ top: 0, bottom: 180, left: 0, right: 0 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 150 }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      addMarkers(map, filteredIncidents);
      addMeasureLayers(map);
      for (const bid of ['boundary_country_outline', 'boundary_country_inner']) {
        if (map.getLayer(bid)) {
          try { map.setLayoutProperty(bid, 'visibility', 'none'); } catch { /* gone */ }
        }
      }
    });
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
    mapRef.current = map;
    const ro = new ResizeObserver(() => { requestAnimationFrame(() => map.resize()); });
    ro.observe(mapContainer.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    addMarkers(map, filteredIncidents);
  }, [filteredIncidents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Skip on mount — the map constructor already set the initial style
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const is3D = activeStyle === '3d';
    if (!is3D) disable3D(map);

    const canvas = map.getCanvas();
    canvas.style.transition = 'opacity 250ms ease';
    canvas.style.opacity = '0.15';

    map.setStyle(MAP_STYLES[activeStyle]!);
    map.triggerRepaint();

    const showCanvas = () => {
      canvas.style.opacity = '1';
      setTimeout(() => { canvas.style.transition = ''; }, 300);
    };

    const failsafe = setTimeout(showCanvas, 3000);

    let tries = 0;
    const reAdd = () => {
      addMeasureLayers(map);
      addMarkers(map, filteredIncidents);
      if (measureRef.current.points.length > 0) updateMeasureGeometry(map, measureRef.current.points);
      if (is3D) enable3D(map);
      const applied = applyRoads(map, activeStyle, showRoadsRef.current);
      if (!applied && tries < 6) { tries += 1; map.once('idle', reAdd); return; }
      clearTimeout(failsafe);
      showCanvas();
    };
    map.once('idle', reAdd);
    return () => { map.off('idle', reAdd); clearTimeout(failsafe); };
  }, [activeStyle, addMeasureLayers, updateMeasureGeometry, enable3D, disable3D, applyRoads]);

  // Roads toggle — apply immediately if the style is ready, otherwise the style
  // effect's `idle` handler will pick up the current value.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) applyRoads(map, activeStyle, showRoads);
    else { const h = () => applyRoads(map, activeStyle, showRoads); map.once('idle', h); return () => { map.off('idle', h); }; }
  }, [showRoads, activeStyle, applyRoads]);

  // Brief "how to move around" hint whenever the 3D view is entered.
  useEffect(() => {
    if (activeStyle !== '3d') { setShow3DHint(false); return; }
    setShow3DHint(true);
    const t = setTimeout(() => setShow3DHint(false), 7000);
    return () => clearTimeout(t);
  }, [activeStyle]);

  function addMarkers(map: maplibregl.Map, incidents: MockIncident[]) {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const resolvedList: { id: string; lat: number; lng: number }[] = [];
    const resolvedMap = new Map<string, { lat: number; lng: number }>();
    for (const inc of incidents) {
      const rc = resolveCoords(inc);
      if (rc) { resolvedList.push({ id: inc.id, ...rc }); resolvedMap.set(inc.id, rc); }
    }
    const coordMap = deconflictCoordinates(resolvedList);

    incidents.forEach(incident => {
      const sevMeta = SEVERITY_META[incident.severity];
      const verMeta = VERIFICATION_META[incident.verification];
      const modMeta = MODULE_META[incident.module];
      const baseCoords = resolvedMap.get(incident.id);
      if (!baseCoords) return;
      const coords = coordMap.get(incident.id) ?? baseCoords;
      // Undefined means the source stated no figure — it is NOT a confirmed zero,
      // so it must render as nothing rather than as "0 deceased".
      const dDeceased = incident.casualties?.deceased;
      const dInjured = incident.casualties?.injured;
      const casualtyParts = [
        typeof dDeceased === 'number' && dDeceased > 0 ? `${dDeceased} deceased` : '',
        typeof dInjured === 'number' && dInjured > 0 ? `${dInjured} injured` : '',
      ].filter(Boolean);

      const el = document.createElement('div');
      el.style.cssText = 'width: 14px; height: 14px; cursor: pointer;';
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 14px; height: 14px;
        background: ${sevMeta?.colour ?? '#718096'};
        border-radius: 50%;
        border: ${verMeta?.ring ?? '1px solid transparent'};
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 0 6px ${sevMeta?.colour ?? '#718096'}66;
      `;
      el.appendChild(dot);
      el.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.5)'; dot.style.boxShadow = `0 0 12px ${sevMeta?.colour ?? '#718096'}aa`; });
      el.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; dot.style.boxShadow = `0 0 6px ${sevMeta?.colour ?? '#718096'}66`; });

      const popup = new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: '300px' }).setHTML(`
        <div style="font-family:var(--font-sans);padding:6px 2px">
          <div style="font-size:10px;font-weight:600;color:${modMeta?.colour};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${modMeta?.label}</div>
          <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:4px">${incident.title}</div>
          <div style="font-size:11px;color:#555;margin-bottom:6px;line-height:1.4">${incident.summary.slice(0, 120)}${incident.summary.length > 120 ? '...' : ''}</div>
          <div style="display:flex;gap:8px;font-size:11px;color:#555;flex-wrap:wrap">
            <span style="color:${sevMeta?.colour}">${incident.severity.toUpperCase()}</span>
            <span>${verMeta?.label ?? ''}</span>
            <span>${incident.town}, ${incident.province}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;font-size:10px;color:#888">
            <span>${incident.sourceCount} source${incident.sourceCount !== 1 ? 's' : ''}</span>
            <span>${incident.dateOccurred}</span>
          </div>
          ${casualtyParts.length > 0 ? `<div style="margin-top:4px;font-size:10px;color:#c53030">${casualtyParts.join(', ')}</div>` : ''}
          ${incident.isSynthetic ? '<div style="margin-top:6px;font-size:9px;color:#888;font-style:italic;border-top:1px solid #e2e8f0;padding-top:4px">SYNTHETIC TEST DATA</div>' : ''}
          <button onclick="window.dispatchEvent(new CustomEvent('select-incident',{detail:'${incident.id}'}))" style="margin-top:8px;padding:4px 10px;font-size:11px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:500">View details</button>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([coords.lng, coords.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail;
      setSelectedIncident(id);
    };
    window.addEventListener('select-incident', handler);
    return () => window.removeEventListener('select-incident', handler);
  }, [setSelectedIncident]);

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

  return (
    <div className="map-container">
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {activeStyle === '3d' && show3DHint && (
        <div className="map-3d-hint" role="status">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" />
          </svg>
          Right-click + drag to tilt & rotate · scroll to zoom
          <button className="map-3d-hint-close" onClick={() => setShow3DHint(false)} title="Dismiss">×</button>
        </div>
      )}

      <div className="map-top-controls">
        {measure.active && (
          <div className="measure-panel">
            <div className="measure-header">
              <span className="measure-title">Measure distance</span>
              <button className="measure-close" onClick={clearMeasure} title="Close measure tool">×</button>
            </div>
            <ol className="measure-steps">
              <li>Click a point on the map to start.</li>
              <li>Keep clicking to add legs — the total updates as you go.</li>
              <li><strong>Undo</strong> removes the last point, <strong>Clear</strong> starts over.</li>
            </ol>
            <div className="measure-value">
              {measure.points.length < 2
                ? (measure.points.length === 1 ? 'Click a second point to measure…' : 'Click your first point on the map…')
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
