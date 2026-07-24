'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConsequenceAnalysis, ConsequenceNode, AssetType } from '@/types/ontology';

// ---------------------------------------------------------------------------
// Asset type icons
// ---------------------------------------------------------------------------

const ASSET_ICONS: Record<string, string> = {
  power_station: '⚡',
  substation: '⚡',
  transmission_line: '⚡',
  water_treatment: '💧',
  water_pump: '💧',
  reservoir: '💧',
  dam: '💧',
  cell_tower: '📡',
  fiber_node: '📡',
  submarine_cable: '📡',
  hospital: '🏥',
  clinic: '🏥',
  emergency_service: '🚑',
  road: '🚗',
  bridge: '🌉',
  rail: '🚂',
  port: '⚓',
  airport: '✈️',
  pipeline: '🛢️',
  refinery: '🏭',
  fuel_depot: '⛽',
  school: '🏫',
  government_building: '🏛️',
};

function getAssetIcon(type: AssetType): string {
  return ASSET_ICONS[type] ?? '📦';
}

const CRITICAL_TYPES = new Set<AssetType>(['hospital', 'clinic', 'emergency_service']);

// ---------------------------------------------------------------------------
// Recursive node component
// ---------------------------------------------------------------------------

interface NodeProps {
  node: ConsequenceNode;
  simulating: boolean;
  simulationStage: number;
}

function TreeNode({ node, simulating, simulationStage }: NodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const isCritical = CRITICAL_TYPES.has(node.asset.type);
  const visible = !simulating || node.depth <= simulationStage;

  if (!visible) return null;

  const delayMs = simulating ? node.depth * 0.8 : 0;

  return (
    <motion.div
      initial={simulating ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: delayMs }}
      style={{ marginLeft: node.depth * 24 }}
    >
      <div
        className="consequence-node"
        data-depth={Math.min(node.depth, 3)}
        data-critical-service={isCritical ? 'true' : undefined}
        onClick={() => hasChildren && setCollapsed((c) => !c)}
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        style={{ cursor: hasChildren ? 'pointer' : 'default' }}
      >
        <span style={{ fontSize: 'var(--text-lg)', lineHeight: 1 }}>
          {getAssetIcon(node.asset.type)}
        </span>
        <div className="consequence-node-info">
          <div className="consequence-node-name">
            {node.asset.name}
            {node.depth === 0 && (
              <span
                style={{
                  marginLeft: 'var(--sp-2)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color: 'var(--status-critical)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '1px var(--sp-2)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                FAILED
              </span>
            )}
            {hasChildren && (
              <span
                style={{
                  marginLeft: 'var(--sp-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {collapsed ? '▶' : '▼'} {node.children.length}
              </span>
            )}
          </div>
          <div className="consequence-node-meta">
            <span className="consequence-node-pop">
              {node.populationExposed.toLocaleString()} exposed
            </span>
            {node.estimatedRecoveryHours !== null && (
              <span>{node.estimatedRecoveryHours}h recovery</span>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {!collapsed &&
          hasChildren &&
          node.children.map((child) => (
            <TreeNode
              key={child.assetId}
              node={child}
              simulating={simulating}
              simulationStage={simulationStage}
            />
          ))}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ConsequenceTreeProps {
  analysis: ConsequenceAnalysis | null;
}

export default function ConsequenceTree({ analysis }: ConsequenceTreeProps) {
  const [simulating, setSimulating] = useState(false);
  const [simulationStage, setSimulationStage] = useState(0);

  const startSimulation = useCallback(() => {
    setSimulating(true);
    setSimulationStage(0);

    // Reveal each depth level with staggered timing
    const maxDepth = 4;
    for (let d = 1; d <= maxDepth; d++) {
      setTimeout(() => setSimulationStage(d), d * 800);
    }

    // End simulation mode after all stages revealed
    setTimeout(() => {
      setSimulating(false);
      setSimulationStage(0);
    }, (maxDepth + 1) * 800);
  }, []);

  if (!analysis) {
    return (
      <div
        className="consequence-tree"
        style={{
          padding: 'var(--sp-6)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        No cascade analysis available. Select an infrastructure asset to model failure consequences.
      </div>
    );
  }

  const criticalCount = analysis.criticalServicesAffected.length;

  // Count cascade stages (max depth in tree)
  function getMaxDepth(node: ConsequenceNode): number {
    if (node.children.length === 0) return node.depth;
    return Math.max(...node.children.map(getMaxDepth));
  }
  const cascadeStages = getMaxDepth(analysis.tree);

  return (
    <div className="consequence-tree">
      {/* Simulate button */}
      <div style={{ marginBottom: 'var(--sp-3)' }}>
        <button
          onClick={startSimulation}
          disabled={simulating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            padding: 'var(--sp-2) var(--sp-4)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: simulating ? 'var(--accent-muted)' : 'transparent',
            color: simulating ? 'var(--accent)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            cursor: simulating ? 'not-allowed' : 'pointer',
            transition: 'all var(--ease-fast)',
          }}
        >
          {simulating ? 'Simulating...' : 'Simulate Cascade'}
        </button>
      </div>

      {/* Tree */}
      <TreeNode node={analysis.tree} simulating={simulating} simulationStage={simulationStage} />

      {/* Summary footer */}
      <div className="consequence-summary">
        <div className="consequence-stat">
          <div className="consequence-stat-value">
            {analysis.totalPopulationExposed.toLocaleString()}
          </div>
          <div className="consequence-stat-label">Total Population Exposed</div>
        </div>
        <div className="consequence-stat">
          <div className="consequence-stat-value">{criticalCount}</div>
          <div className="consequence-stat-label">Critical Services Affected</div>
        </div>
        <div className="consequence-stat">
          <div className="consequence-stat-value">{cascadeStages}</div>
          <div className="consequence-stat-label">Cascade Stages</div>
        </div>
      </div>

      {/* Data gaps */}
      {analysis.dataGaps.length > 0 && (
        <div
          style={{
            marginTop: 'var(--sp-4)',
            padding: 'var(--sp-3)',
            background: 'rgba(234, 179, 8, 0.06)',
            borderLeft: '2px solid var(--status-medium)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--status-medium)',
              marginBottom: 'var(--sp-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Data Gaps
          </div>
          {analysis.dataGaps.map((gap, i) => (
            <div
              key={i}
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                padding: 'var(--sp-1) 0',
              }}
            >
              {gap}
            </div>
          ))}
        </div>
      )}

      {/* Worst / Best case */}
      <div
        style={{
          marginTop: 'var(--sp-3)',
          display: 'flex',
          gap: 'var(--sp-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
        }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, color: 'var(--status-critical)' }}>Worst case: </span>
          {analysis.worstCase}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, color: 'var(--status-low)' }}>Best case: </span>
          {analysis.bestCase}
        </div>
      </div>
    </div>
  );
}
