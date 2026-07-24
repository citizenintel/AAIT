import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/stores/app-store';
import { getPriorityDevelopments } from '@/lib/attention-engine';
import { IntelligenceMap } from '@/components/map/IntelligenceMap';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import ConfidenceAnatomy from '@/components/shared/ConfidenceAnatomy';
import type { IntelligenceEvent } from '@/types/ontology';

const PROVINCES = [
  { abbr: 'GP', name: 'Gauteng' },
  { abbr: 'KZ', name: 'KwaZulu-Natal' },
  { abbr: 'WC', name: 'Western Cape' },
  { abbr: 'EC', name: 'Eastern Cape' },
  { abbr: 'LP', name: 'Limpopo' },
  { abbr: 'MP', name: 'Mpumalanga' },
  { abbr: 'NW', name: 'North West' },
  { abbr: 'FS', name: 'Free State' },
  { abbr: 'NC', name: 'Northern Cape' },
];

const BASELINE_STATS = {
  averageEventCountPerHour: 2,
  averageEventCountPerDay: 48,
  historicalEventTypeCounts: {
    conflict: 120, protest: 200, crime: 500, infrastructure_failure: 80,
    natural_disaster: 30, political: 60, economic: 40, cyber: 10,
    maritime: 15, health: 25, market_event: 50,
  },
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function getSeverityForEvent(e: IntelligenceEvent): 'critical' | 'high' | 'medium' | 'low' {
  const change = e.changeFromBaseline;
  if (!change) return 'medium';
  if (change.changeFromWeekBaseline > 150 || change.isFirstOccurrence) return 'critical';
  if (change.changeFromWeekBaseline > 80) return 'high';
  if (change.changeFromWeekBaseline > 30) return 'medium';
  return 'low';
}

function getProvinceSeverity(events: IntelligenceEvent[], province: string): string {
  const matching = events.filter((e) => e.location.province === province);
  if (matching.length === 0) return 'var(--text-tertiary)';
  const severities = matching.map(getSeverityForEvent);
  const worst = severities.sort((a, b) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b])[0];
  const colors = { critical: 'var(--status-critical)', high: 'var(--status-high)', medium: 'var(--status-medium)', low: 'var(--status-low)' };
  return colors[worst!] ?? 'var(--text-tertiary)';
}

export function GlanceView() {
  const { incidents } = useIncidentData();
  const events = useAppStore((s) => s.events);
  const assets = useAppStore((s) => s.assets);
  const watchAreas = useAppStore((s) => s.watchAreas);
  const activeLens = useAppStore((s) => s.activeLens);
  const renderingTier = useAppStore((s) => s.renderingTier);
  const currentTime = useAppStore((s) => s.currentTime);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const setInterfaceLevel = useAppStore((s) => s.setInterfaceLevel);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const sourceHealth = useAppStore((s) => s.sourceHealth);

  const eventArray = useMemo(() => Array.from(events.values()), [events]);
  const assetArray = useMemo(() => Array.from(assets.values()), [assets]);

  const priorities = useMemo(
    () => getPriorityDevelopments(eventArray, watchAreas, BASELINE_STATS),
    [eventArray, watchAreas],
  );

  const handleCardClick = (id: string) => {
    selectEvent(id);
    setInterfaceLevel('investigate');
  };

  const isLoading = eventArray.length === 0;

  return (
    <div className="glance-view">
      <div className="glance-priorities">
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-1)' }}>
          Priority Developments
        </div>

        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="priority-card">
                <div className="priority-card-severity skeleton" style={{ width: 3, minHeight: 60 }} />
                <div className="priority-card-content">
                  <div className="skeleton" style={{ height: 16, width: '80%' }} />
                  <div className="skeleton" style={{ height: 12, width: '50%', marginTop: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '30%', marginTop: 8 }} />
                </div>
              </div>
            ))
          : priorities.map((evt) => {
              const severity = getSeverityForEvent(evt);
              const change = evt.changeFromBaseline;
              return (
                <div
                  key={evt.id}
                  className="priority-card"
                  onClick={() => handleCardClick(evt.id)}
                >
                  <div className="priority-card-severity" data-severity={severity} />
                  <div className="priority-card-content">
                    <div className="priority-card-title">{evt.title}</div>
                    <div className="priority-card-meta">
                      <span>{evt.location.placeName}, {evt.location.province}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(evt.timestamp, { addSuffix: true })}</span>
                    </div>
                    <div className="priority-card-indicators">
                      <ConfidenceAnatomy confidence={evt.confidence} mode="compact" />
                      {change && change.changeFromWeekBaseline > 50 && (
                        <span className="change-badge" data-type="above-baseline">
                          ↑ {Math.round(change.changeFromWeekBaseline)}% above baseline
                        </span>
                      )}
                      {change?.isFirstOccurrence && (
                        <span className="change-badge" data-type="first-occurrence">
                          First occurrence
                        </span>
                      )}
                      {change && change.accelerationRate > 1.5 && (
                        <span className="change-badge" data-type="escalating">
                          Accelerating
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      <div className="glance-map">
        <IntelligenceMap
          events={priorities}
          assets={assetArray}
          incidents={incidents}
          renderingTier={renderingTier}
          activeLens={activeLens}
          selectedEventId={selectedEventId}
          onEventSelect={(id) => { if (id) handleCardClick(id); }}
          currentTime={currentTime}
        />
      </div>

      <div className="glance-health">
        <div className="province-strip">
          {PROVINCES.map((p) => (
            <div key={p.abbr} className="province-indicator" title={p.name}>
              <span className="province-abbr">{p.abbr}</span>
              <span
                className="province-dot"
                style={{ background: getProvinceSeverity(eventArray, p.name) }}
              />
            </div>
          ))}
        </div>
        <div className="data-freshness">
          {Array.from(sourceHealth.entries()).map(([id, check]) => (
            <span key={id} className="source-health-dot" data-health={check.isHealthy ? 'healthy' : 'down'}>
              {id}
            </span>
          ))}
          {sourceHealth.size === 0 && (
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              Source health: checking...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
