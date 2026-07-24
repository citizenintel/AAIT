import { useEffect, useRef, useMemo, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { useAppStore } from '@/stores/app-store';
import type { IntelligenceEvent, InfrastructureAsset } from '@/types/ontology';

const EVENT_COLORS: Record<string, string> = {
  infrastructure_failure: '#ef4444',
  crime: '#f97316',
  protest: '#eab308',
  natural_disaster: '#06b6d4',
  political: '#8b5cf6',
  cyber: '#ec4899',
  maritime: '#14b8a6',
  health: '#22c55e',
  market_event: '#6366f1',
  economic: '#a78bfa',
  conflict: '#dc2626',
  environmental: '#10b981',
  energy: '#f59e0b',
  aviation: '#64748b',
  other: '#636366',
};

const ASSET_COLORS: Record<string, string> = {
  power_station: '#f97316',
  substation: '#fb923c',
  transmission_line: '#fdba74',
  water_treatment: '#3b82f6',
  water_pump: '#60a5fa',
  reservoir: '#93c5fd',
  dam: '#2563eb',
  hospital: '#22c55e',
  clinic: '#4ade80',
  emergency_service: '#ef4444',
  road: '#a1a1a6',
  port: '#14b8a6',
  cell_tower: '#8b5cf6',
  bridge: '#78716c',
  rail: '#64748b',
  pipeline: '#d97706',
  refinery: '#b45309',
  fuel_depot: '#92400e',
  school: '#06b6d4',
  government_building: '#6366f1',
  fiber_node: '#a78bfa',
  submarine_cable: '#0ea5e9',
  airport: '#475569',
};

interface Props {
  events: IntelligenceEvent[];
  assets: InfrastructureAsset[];
  onEventSelect?: (id: string) => void;
  onAssetSelect?: (id: string) => void;
}

function buildGraph(events: IntelligenceEvent[], assets: InfrastructureAsset[]): Graph {
  const g = new Graph({ multi: false, type: 'undirected' });

  for (const evt of events) {
    g.addNode(evt.id, {
      label: evt.title.length > 40 ? evt.title.slice(0, 37) + '...' : evt.title,
      x: evt.location.longitude + (Math.sin(evt.id.charCodeAt(4) || 0) * 0.5),
      y: -evt.location.latitude + (Math.cos(evt.id.charCodeAt(4) || 0) * 0.5),
      size: Math.max(6, Math.min(18, (evt.confidence.overall / 100) * 18)),
      color: EVENT_COLORS[evt.type] ?? EVENT_COLORS.other,
      nodeType: 'event',
      eventType: evt.type,
    });
  }

  for (const asset of assets) {
    g.addNode(asset.id, {
      label: asset.name.length > 35 ? asset.name.slice(0, 32) + '...' : asset.name,
      x: asset.location.longitude + (Math.sin(asset.id.charCodeAt(6) || 0) * 0.3),
      y: -asset.location.latitude + (Math.cos(asset.id.charCodeAt(6) || 0) * 0.3),
      size: Math.max(4, Math.min(12, (asset.populationExposed / 1000000) * 3)),
      color: ASSET_COLORS[asset.type] ?? '#636366',
      nodeType: 'asset',
      assetType: asset.type,
    });
  }

  for (const evt of events) {
    for (const relId of evt.relatedEvents) {
      if (g.hasNode(relId) && !g.hasEdge(evt.id, relId)) {
        g.addEdge(evt.id, relId, {
          color: 'rgba(99, 99, 102, 0.4)',
          size: 1.5,
          edgeType: 'event-event',
        });
      }
    }
    for (const assetId of evt.relatedAssets) {
      if (g.hasNode(assetId) && !g.hasEdge(evt.id, assetId)) {
        g.addEdge(evt.id, assetId, {
          color: 'rgba(59, 130, 246, 0.3)',
          size: 1,
          edgeType: 'event-asset',
        });
      }
    }
  }

  for (const asset of assets) {
    for (const dep of asset.dependencies) {
      if (g.hasNode(dep.targetAssetId) && !g.hasEdge(asset.id, dep.targetAssetId)) {
        const critColors = { critical: 'rgba(239, 68, 68, 0.5)', important: 'rgba(249, 115, 22, 0.4)', convenience: 'rgba(99, 99, 102, 0.3)' };
        g.addEdge(asset.id, dep.targetAssetId, {
          color: critColors[dep.criticality] ?? 'rgba(99, 99, 102, 0.3)',
          size: dep.criticality === 'critical' ? 2 : 1,
          edgeType: 'dependency',
          dependencyType: dep.dependencyType,
        });
      }
    }
  }

  return g;
}

export function RelationshipGraph({ events, assets, onEventSelect, onAssetSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'events' | 'assets'>('all');

  const graph = useMemo(() => buildGraph(events, assets), [events, assets]);

  useEffect(() => {
    if (!containerRef.current || graph.order === 0) return;

    const sigma = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      labelFont: 'Inter, system-ui, sans-serif',
      labelSize: 11,
      labelColor: { color: '#a1a1a6' },
      labelRenderedSizeThreshold: 8,
      defaultEdgeType: 'line',
      allowInvalidContainer: true,
      stagePadding: 40,
    });

    sigmaRef.current = sigma;

    sigma.on('enterNode', ({ node }) => setHoveredNode(node));
    sigma.on('leaveNode', () => setHoveredNode(null));
    sigma.on('clickNode', ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      if (attrs.nodeType === 'event' && onEventSelect) onEventSelect(node);
      if (attrs.nodeType === 'asset' && onAssetSelect) onAssetSelect(node);
    });

    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph, onEventSelect, onAssetSelect]);

  useEffect(() => {
    if (!sigmaRef.current) return;

    sigmaRef.current.setSetting('nodeReducer', (node, data) => {
      const res = { ...data };
      if (filter === 'events' && data.nodeType === 'asset') {
        res.hidden = true;
      } else if (filter === 'assets' && data.nodeType === 'event') {
        res.hidden = true;
      }
      if (hoveredNode) {
        if (node === hoveredNode) {
          res.highlighted = true;
          res.zIndex = 1;
        } else if (graph.hasEdge(node, hoveredNode) || graph.hasEdge(hoveredNode, node)) {
          res.zIndex = 1;
        } else {
          res.color = 'rgba(99, 99, 102, 0.15)';
          res.label = '';
        }
      }
      return res;
    });

    sigmaRef.current.setSetting('edgeReducer', (_edge, data) => {
      const res = { ...data };
      if (hoveredNode) {
        const [src, tgt] = graph.extremities(_edge);
        if (src !== hoveredNode && tgt !== hoveredNode) {
          res.hidden = true;
        }
      }
      return res;
    });

    sigmaRef.current.refresh();
  }, [hoveredNode, filter, graph]);

  const hoveredAttrs = hoveredNode ? graph.getNodeAttributes(hoveredNode) : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: 'var(--surface-0)' }} />

      <div style={{
        position: 'absolute', top: 'var(--sp-3)', left: 'var(--sp-3)',
        display: 'flex', gap: 'var(--sp-1)', zIndex: 10,
      }}>
        {(['all', 'events', 'assets'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              background: filter === f ? 'var(--accent-muted)' : 'var(--surface-2)',
              color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: 'var(--sp-3)', left: 'var(--sp-3)',
        display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', zIndex: 10,
        fontSize: '10px', color: 'var(--text-tertiary)',
      }}>
        <span>{graph.order} nodes</span>
        <span>{graph.size} edges</span>
        <span>{events.length} events</span>
        <span>{assets.length} assets</span>
      </div>

      {hoveredAttrs && (
        <div style={{
          position: 'absolute', top: 'var(--sp-3)', right: 'var(--sp-3)',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)',
          maxWidth: 280, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-1)' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: hoveredAttrs.color as string, flexShrink: 0,
            }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {hoveredAttrs.label as string}
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {hoveredAttrs.nodeType === 'event' ? hoveredAttrs.eventType as string : hoveredAttrs.assetType as string}
            {' · '}
            {graph.degree(hoveredNode!)} connections
          </div>
        </div>
      )}
    </div>
  );
}
