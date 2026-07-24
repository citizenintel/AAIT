import type { IntelligenceEvent, InfrastructureAsset, AIAction } from '@/types/ontology';

interface DirectorContext {
  events: IntelligenceEvent[];
  assets: InfrastructureAsset[];
}

interface QueryResult {
  answer: string;
  actions: AIAction[];
  relatedEventIds: string[];
}

const PROVINCE_COORDS: Record<string, [number, number]> = {
  gauteng: [28.0473, -26.2041],
  'kwazulu-natal': [30.5595, -29.0000],
  kzn: [30.5595, -29.0000],
  'western cape': [18.8735, -33.2278],
  'eastern cape': [26.5000, -32.0000],
  limpopo: [29.4688, -23.9045],
  mpumalanga: [29.9846, -26.5279],
  'north west': [25.5000, -26.0000],
  'free state': [26.2000, -29.0000],
  'northern cape': [21.0000, -29.0000],
};

const EVENT_TYPE_ALIASES: Record<string, string> = {
  'load shedding': 'infrastructure_failure',
  power: 'infrastructure_failure',
  electricity: 'infrastructure_failure',
  infrastructure: 'infrastructure_failure',
  water: 'infrastructure_failure',
  farm: 'crime',
  attack: 'crime',
  robbery: 'crime',
  theft: 'crime',
  protest: 'protest',
  unrest: 'protest',
  flood: 'natural_disaster',
  weather: 'natural_disaster',
  earthquake: 'natural_disaster',
  politics: 'political',
  political: 'political',
  government: 'political',
  anc: 'political',
  da: 'political',
  coalition: 'political',
  cyber: 'cyber',
  ransomware: 'cyber',
  hack: 'cyber',
  maritime: 'maritime',
  vessel: 'maritime',
  ship: 'maritime',
  port: 'maritime',
  health: 'health',
  cholera: 'health',
  disease: 'health',
  market: 'market_event',
  rand: 'market_event',
  currency: 'market_event',
  jse: 'market_event',
  energy: 'energy',
  eskom: 'energy',
};

function matchProvince(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [key] of Object.entries(PROVINCE_COORDS)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

function matchEventType(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [keyword, type] of Object.entries(EVENT_TYPE_ALIASES)) {
    if (lower.includes(keyword)) return type;
  }
  return null;
}

function isCountQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return /how many|count|total|number of/.test(lower);
}

function isSummaryQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return /summarize|summary|brief|overview|what.*happening|situation|status/.test(lower);
}

function isCompareQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return /compare|versus|vs\.?|difference between/.test(lower);
}

function isWorstQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return /worst|most critical|highest risk|most dangerous|most severe/.test(lower);
}

function generateSummary(events: IntelligenceEvent[]): string {
  const active = events.filter((e) => e.status === 'active' || e.status === 'developing');
  const byType: Record<string, number> = {};
  const byProvince: Record<string, number> = {};

  for (const e of active) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    byProvince[e.location.province] = (byProvince[e.location.province] ?? 0) + 1;
  }

  const topTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${t.replace(/_/g, ' ')} (${n})`)
    .join(', ');

  const topProvinces = Object.entries(byProvince)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p, n]) => `${p} (${n})`)
    .join(', ');

  const critical = active.filter((e) => {
    const c = e.changeFromBaseline;
    return c && (c.changeFromWeekBaseline > 100 || c.isFirstOccurrence);
  });

  return [
    `${active.length} active/developing events tracked.`,
    `Top categories: ${topTypes}.`,
    `Most affected: ${topProvinces}.`,
    critical.length > 0
      ? `${critical.length} critical developments above baseline: ${critical.map((e) => e.title).join('; ')}.`
      : 'No critical deviations from baseline.',
  ].join(' ');
}

export function processQuery(query: string, ctx: DirectorContext): QueryResult {
  const actions: AIAction[] = [];
  const relatedEventIds: string[] = [];
  let answer = '';

  const province = matchProvince(query);
  const eventType = matchEventType(query);

  if (province) {
    const coords = PROVINCE_COORDS[province];
    if (coords) {
      actions.push({
        type: 'setGeography',
        parameters: { center: coords, zoom: 8, province },
        description: `Zoom to ${province}`,
        reversible: true,
      });
    }
  }

  if (eventType) {
    actions.push({
      type: 'setEventFilter',
      parameters: { eventType },
      description: `Filter to ${eventType.replace(/_/g, ' ')} events`,
      reversible: true,
    });
  }

  let filtered = ctx.events;
  if (eventType) {
    filtered = filtered.filter((e) => e.type === eventType);
  }
  if (province) {
    filtered = filtered.filter((e) => e.location.province.toLowerCase().includes(province));
  }

  if (isCountQuery(query)) {
    const active = filtered.filter((e) => e.status === 'active' || e.status === 'developing');
    answer = `${active.length} active/developing events`;
    if (eventType) answer += ` of type "${eventType.replace(/_/g, ' ')}"`;
    if (province) answer += ` in ${province}`;
    answer += ` out of ${filtered.length} total.`;
    relatedEventIds.push(...active.map((e) => e.id));
  } else if (isWorstQuery(query)) {
    const sorted = [...filtered]
      .filter((e) => e.changeFromBaseline)
      .sort((a, b) => (b.changeFromBaseline?.changeFromWeekBaseline ?? 0) - (a.changeFromBaseline?.changeFromWeekBaseline ?? 0));
    const top = sorted.slice(0, 3);
    if (top.length > 0) {
      answer = `Most critical: ${top.map((e) => `${e.title} (${e.changeFromBaseline?.changeFromWeekBaseline ?? 0}% above baseline)`).join('; ')}.`;
      relatedEventIds.push(...top.map((e) => e.id));
      if (top[0]) {
        actions.push({
          type: 'displayLocations',
          parameters: { eventIds: top.map((e) => e.id) },
          description: 'Highlight critical events on map',
          reversible: true,
        });
      }
    } else {
      answer = 'No events with baseline deviation data found.';
    }
  } else if (isSummaryQuery(query)) {
    answer = generateSummary(filtered);
  } else if (isCompareQuery(query)) {
    answer = 'Comparison queries require two explicit time periods or categories. Try: "compare infrastructure vs crime events" or "compare Gauteng vs KZN".';
  } else if (filtered.length > 0 && filtered.length < ctx.events.length) {
    const active = filtered.filter((e) => e.status === 'active' || e.status === 'developing');
    answer = `Found ${active.length} active events matching your query: ${active.map((e) => e.title).join('; ')}.`;
    relatedEventIds.push(...active.map((e) => e.id));
  } else if (filtered.length === ctx.events.length && !province && !eventType) {
    answer = generateSummary(ctx.events);
  } else {
    answer = 'No matching events found. Try asking about a province, event type, or request a summary.';
  }

  return { answer, actions, relatedEventIds };
}

export function executeAction(action: AIAction): void {
  switch (action.type) {
    case 'setGeography':
    case 'setEventFilter':
    case 'displayLocations':
    case 'setVerification':
    case 'calculateTravelTime':
    case 'compareTimePeriods':
    case 'generateCharts':
    case 'openReportPreview':
      break;
  }
}
