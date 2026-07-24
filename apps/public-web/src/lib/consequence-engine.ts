import type {
  InfrastructureAsset,
  ConsequenceNode,
  ConsequenceAnalysis,
  CascadeTimelineStep,
  AssetType,
} from '@/types/ontology';

const RECOVERY_HOURS: Partial<Record<AssetType, number>> = {
  substation: 12,
  water_pump: 4,
  cell_tower: 6,
  bridge: 168,
  pipeline: 72,
  power_station: 48,
  water_treatment: 8,
  transmission_line: 24,
  reservoir: 36,
  fiber_node: 8,
  refinery: 96,
  fuel_depot: 48,
  dam: 336,
  road: 72,
  rail: 48,
  port: 24,
  airport: 12,
};

const CRITICAL_SERVICE_TYPES: Set<AssetType> = new Set([
  'hospital',
  'clinic',
  'emergency_service',
]);

function buildConsequenceTree(
  failedAssetId: string,
  allAssets: Map<string, InfrastructureAsset>,
  maxDepth: number,
): ConsequenceNode | null {
  const rootAsset = allAssets.get(failedAssetId);
  if (!rootAsset) return null;

  const visited = new Set<string>();

  function recurse(assetId: string, depth: number): ConsequenceNode | null {
    if (visited.has(assetId) || depth > maxDepth) return null;
    visited.add(assetId);

    const asset = allAssets.get(assetId);
    if (!asset) return null;

    const children: ConsequenceNode[] = [];

    for (const [, candidate] of allAssets) {
      for (const dep of candidate.dependencies) {
        if (dep.targetAssetId === assetId && dep.redundancy < 80) {
          const child = recurse(candidate.id, depth + 1);
          if (child) children.push(child);
        }
      }
    }

    return {
      assetId: asset.id,
      asset,
      depth,
      impactType: depth === 0 ? 'direct failure' : `cascade depth ${depth}`,
      populationExposed: asset.populationExposed,
      estimatedRecoveryHours: RECOVERY_HOURS[asset.type] ?? null,
      alternativeRoutes: findAlternatives(asset, allAssets),
      children,
    };
  }

  return recurse(failedAssetId, 0);
}

function findAlternatives(
  asset: InfrastructureAsset,
  allAssets: Map<string, InfrastructureAsset>,
): string[] {
  const alternatives: string[] = [];
  for (const [, candidate] of allAssets) {
    if (
      candidate.id !== asset.id &&
      candidate.type === asset.type &&
      candidate.status === 'operational'
    ) {
      const dx = candidate.location.latitude - asset.location.latitude;
      const dy = candidate.location.longitude - asset.location.longitude;
      const distKm = Math.sqrt(dx * dx + dy * dy) * 111;
      if (distKm < 100) {
        alternatives.push(`${candidate.name} (~${Math.round(distKm)}km)`);
      }
    }
  }
  return alternatives;
}

function collectAllNodes(node: ConsequenceNode): ConsequenceNode[] {
  const result: ConsequenceNode[] = [node];
  for (const child of node.children) {
    result.push(...collectAllNodes(child));
  }
  return result;
}

export function analyzeConsequences(
  failedAssetId: string,
  allAssets: Map<string, InfrastructureAsset>,
  maxDepth = 4,
): ConsequenceAnalysis | null {
  const rootAsset = allAssets.get(failedAssetId);
  if (!rootAsset) return null;

  const tree = buildConsequenceTree(failedAssetId, allAssets, maxDepth);
  if (!tree) return null;

  const allNodes = collectAllNodes(tree);

  const criticalServicesAffected = allNodes
    .filter((n) => CRITICAL_SERVICE_TYPES.has(n.asset.type))
    .map((n) => n.asset);

  const seenH3 = new Set<string>();
  let totalPopulation = 0;
  for (const node of allNodes) {
    if (!seenH3.has(node.asset.h3Index)) {
      seenH3.add(node.asset.h3Index);
      totalPopulation += node.populationExposed;
    }
  }

  const allAlternatives = allNodes.flatMap((n) => n.alternativeRoutes);

  const dataGaps: string[] = [];
  for (const node of allNodes) {
    if (node.asset.status === 'unknown') {
      dataGaps.push(`Status unknown: ${node.asset.name}`);
    }
    if (node.asset.populationExposed === 0) {
      dataGaps.push(`Missing population data: ${node.asset.name}`);
    }
    if (node.asset.dependencies.length === 0 && node.asset.dependents.length === 0) {
      dataGaps.push(`No mapped dependencies: ${node.asset.name}`);
    }
  }

  const maxRecovery = Math.max(
    ...allNodes.map((n) => n.estimatedRecoveryHours ?? 0),
  );

  const worstCase = `Full cascade failure affects ${totalPopulation.toLocaleString()} people across ${allNodes.length} assets. ` +
    `${criticalServicesAffected.length} critical services (hospitals/clinics/emergency) impacted. ` +
    `Estimated maximum recovery: ${maxRecovery} hours. No alternative routes available for ${allNodes.filter((n) => n.alternativeRoutes.length === 0).length} assets.`;

  const bestCase = `Failure contained to ${tree.asset.name}. ` +
    `Redundancy and alternative routes limit cascade. ` +
    `Recovery estimated at ${RECOVERY_HOURS[rootAsset.type] ?? 'unknown'} hours for primary asset.`;

  return {
    rootAsset,
    tree,
    criticalServicesAffected,
    totalPopulationExposed: totalPopulation,
    alternativeRoutes: allAlternatives,
    dataGaps,
    worstCase,
    bestCase,
  };
}

const CASCADE_DELAYS = [0, 0.5, 2, 6, 12];

export function simulateCascade(
  analysis: ConsequenceAnalysis,
): CascadeTimelineStep[] {
  const allNodes = collectAllNodes(analysis.tree);
  const byDepth = new Map<number, ConsequenceNode[]>();

  for (const node of allNodes) {
    const existing = byDepth.get(node.depth) ?? [];
    existing.push(node);
    byDepth.set(node.depth, existing);
  }

  const steps: CascadeTimelineStep[] = [];
  let cumulativePopulation = 0;

  const maxDepth = Math.max(...allNodes.map((n) => n.depth));
  for (let d = 0; d <= maxDepth; d++) {
    const nodesAtDepth = byDepth.get(d) ?? [];
    const newlyAffected = nodesAtDepth.map((n) => n.asset);
    cumulativePopulation += nodesAtDepth.reduce((sum, n) => sum + n.populationExposed, 0);

    const hours = CASCADE_DELAYS[d] ?? CASCADE_DELAYS[CASCADE_DELAYS.length - 1]!;
    const critCount = newlyAffected.filter((a) => CRITICAL_SERVICE_TYPES.has(a.type)).length;

    let desc = `+${hours}h: ${newlyAffected.length} asset(s) affected`;
    if (critCount > 0) desc += ` including ${critCount} critical service(s)`;
    desc += `. Cumulative population: ${cumulativePopulation.toLocaleString()}.`;

    steps.push({
      hoursSinceFailure: hours,
      newlyAffected,
      cumulativePopulation,
      description: desc,
    });
  }

  return steps;
}
