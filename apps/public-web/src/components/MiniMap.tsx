import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useAppStore } from '@/stores/app-store';

const SA_CENTER: [number, number] = [25.5, -28.0];
const SA_ZOOM = 4.2;

const LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '&copy; CartoDB',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f0f0f0' } },
    { id: 'carto', type: 'raster', source: 'carto' },
  ],
};

export function MiniMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const boxSourceRef = useRef(false);
  const viewport = useAppStore((s) => s.mapViewport);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: LIGHT_STYLE,
      center: SA_CENTER,
      zoom: SA_ZOOM,
      interactive: false,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.addSource('viewport-box', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'viewport-box-fill',
        type: 'fill',
        source: 'viewport-box',
        paint: { 'fill-color': '#facc15', 'fill-opacity': 0.25 },
      });
      map.addLayer({
        id: 'viewport-box-line',
        type: 'line',
        source: 'viewport-box',
        paint: { 'line-color': '#facc15', 'line-width': 2 },
      });
      boxSourceRef.current = true;
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boxSourceRef.current || !viewport) return;

    const src = map.getSource('viewport-box') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const [[w, s], [e, n]] = viewport.bounds;
    src.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
      },
    });
  }, [viewport]);

  return (
    <div className="mini-map-container">
      <div className="mini-map-label">OVERVIEW</div>
      <div ref={containerRef} className="mini-map" />
    </div>
  );
}
