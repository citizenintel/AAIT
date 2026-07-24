import type {
  IntelligenceEvent,
  WatchArea,
  AttentionScore,
  ChangeMetrics,
} from '@/types/ontology';

interface BaselineStats {
  averageEventCountPerHour: number;
  averageEventCountPerDay: number;
  historicalEventTypeCounts: Record<string, number>;
}

const WEIGHTS = {
  changeFromBaseline: 0.20,
  accelerationRate: 0.15,
  geographicSpread: 0.10,
  reliability: 0.10,
  populationExposure: 0.10,
  infrastructureImportance: 0.10,
  novelty: 0.10,
  sourceConvergence: 0.08,
  watchAreaRelevance: 0.07,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeChange(metrics: ChangeMetrics | null): number {
  if (!metrics) return 0;
  const raw = Math.abs(metrics.changeFromWeekBaseline) * 0.5;
  return clamp(raw, 0, 100);
}

function normalizeAcceleration(metrics: ChangeMetrics | null): number {
  if (!metrics) return 0;
  return clamp(metrics.accelerationRate * 50, 0, 100);
}

function normalizeSpread(metrics: ChangeMetrics | null): number {
  if (!metrics) return 0;
  return clamp(Math.log10(metrics.geographicSpread + 1) * 25, 0, 100);
}

function normalizePopulation(event: IntelligenceEvent): number {
  const pop = event.location.radiusKm * 1000;
  return clamp(Math.log10(pop + 1) * 16.7, 0, 100);
}

function normalizeReliability(event: IntelligenceEvent): number {
  return clamp(event.confidence.overall, 0, 100);
}

function normalizeInfrastructure(event: IntelligenceEvent): number {
  return clamp(event.relatedAssets.length * 20, 0, 100);
}

function normalizeNovelty(event: IntelligenceEvent, baselineStats: BaselineStats): number {
  if (event.changeFromBaseline?.isFirstOccurrence) return 100;
  const historicalCount = baselineStats.historicalEventTypeCounts[event.type] ?? 0;
  if (historicalCount === 0) return 100;
  const avg = baselineStats.averageEventCountPerDay;
  if (avg === 0) return 50;
  return clamp((1 - historicalCount / (avg * 30)) * 100, 0, 100);
}

function normalizeSourceConvergence(event: IntelligenceEvent): number {
  const types = new Set(event.sources.map((s) => s.sourceType));
  return clamp(types.size * 20, 0, 100);
}

function normalizeWatchAreaRelevance(event: IntelligenceEvent, watchAreas: WatchArea[]): number {
  if (watchAreas.length === 0) return 50;
  const inArea = watchAreas.some((area) =>
    area.h3Cells.includes(event.h3Index),
  );
  return inArea ? 100 : 0;
}

export function calculateAttentionScore(
  event: IntelligenceEvent,
  watchAreas: WatchArea[],
  baselineStats: BaselineStats,
): AttentionScore {
  const factors = {
    changeFromBaseline: normalizeChange(event.changeFromBaseline),
    accelerationRate: normalizeAcceleration(event.changeFromBaseline),
    geographicSpread: normalizeSpread(event.changeFromBaseline),
    reliability: normalizeReliability(event),
    populationExposure: normalizePopulation(event),
    infrastructureImportance: normalizeInfrastructure(event),
    novelty: normalizeNovelty(event, baselineStats),
    sourceConvergence: normalizeSourceConvergence(event),
    watchAreaRelevance: normalizeWatchAreaRelevance(event, watchAreas),
  };

  const score =
    factors.changeFromBaseline * WEIGHTS.changeFromBaseline +
    factors.accelerationRate * WEIGHTS.accelerationRate +
    factors.geographicSpread * WEIGHTS.geographicSpread +
    factors.reliability * WEIGHTS.reliability +
    factors.populationExposure * WEIGHTS.populationExposure +
    factors.infrastructureImportance * WEIGHTS.infrastructureImportance +
    factors.novelty * WEIGHTS.novelty +
    factors.sourceConvergence * WEIGHTS.sourceConvergence +
    factors.watchAreaRelevance * WEIGHTS.watchAreaRelevance;

  return {
    entityId: event.id,
    entityType: 'event',
    score,
    factors,
  };
}

type ChangeQueryType =
  | 'new'
  | 'escalated'
  | 'resolved'
  | 'first_occurrence'
  | 'stopped_reporting'
  | 'moved'
  | 'concentrated'
  | 'revised';

interface ChangeQuery {
  timeframe: 'hour' | 'day' | 'week' | 'month';
  type: ChangeQueryType;
}

function getTimeframeMs(timeframe: ChangeQuery['timeframe']): number {
  const map = { hour: 3600_000, day: 86400_000, week: 604800_000, month: 2592000_000 };
  return map[timeframe];
}

export function detectChanges(
  events: IntelligenceEvent[],
  query: ChangeQuery,
): IntelligenceEvent[] {
  const cutoff = new Date(Date.now() - getTimeframeMs(query.timeframe));

  switch (query.type) {
    case 'new':
      return events.filter((e) => e.reportedAt >= cutoff);

    case 'escalated':
      return events.filter((e) =>
        e.timeline.some(
          (t) => t.type === 'escalation' && t.timestamp >= cutoff,
        ),
      );

    case 'resolved':
      return events.filter(
        (e) => e.status === 'resolved' && e.updatedAt >= cutoff,
      );

    case 'first_occurrence':
      return events.filter(
        (e) => e.changeFromBaseline?.isFirstOccurrence === true && e.reportedAt >= cutoff,
      );

    case 'stopped_reporting':
      return events.filter(
        (e) => e.changeFromBaseline?.stoppedReporting === true,
      );

    case 'moved':
      return events.filter((e) =>
        e.timeline.some(
          (t) => t.locationChange !== undefined && t.timestamp >= cutoff,
        ),
      );

    case 'concentrated':
      return events.filter(
        (e) =>
          e.changeFromBaseline !== null &&
          e.changeFromBaseline.geographicSpread < 10 &&
          e.changeFromBaseline.changeFromWeekBaseline > 50,
      );

    case 'revised':
      return events.filter((e) =>
        e.timeline.some(
          (t) =>
            (t.type === 'correction' || t.type === 'retraction') &&
            t.timestamp >= cutoff,
        ),
      );

    default:
      return [];
  }
}

export function getPriorityDevelopments(
  events: IntelligenceEvent[],
  watchAreas: WatchArea[],
  baselineStats: BaselineStats,
  maxItems = 7,
): Array<IntelligenceEvent & { attentionScore: AttentionScore }> {
  const scored = events
    .filter((e) => e.status === 'active' || e.status === 'developing')
    .map((e) => ({
      ...e,
      attentionScore: calculateAttentionScore(e, watchAreas, baselineStats),
    }))
    .filter((e) => e.attentionScore.score >= 30)
    .sort((a, b) => b.attentionScore.score - a.attentionScore.score);

  const count = Math.max(3, Math.min(maxItems, scored.length));
  return scored.slice(0, count);
}
