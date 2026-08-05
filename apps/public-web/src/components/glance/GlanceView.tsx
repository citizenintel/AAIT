import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/stores/app-store';
import { getPriorityDevelopments } from '@/lib/attention-engine';
import { IntelligenceMap } from '@/components/map/IntelligenceMap';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import { useFilteredIncidents } from '@/lib/hooks/useFilteredIncidents';
import ConfidenceAnatomy from '@/components/shared/ConfidenceAnatomy';
import { WidgetPanel } from '@/components/widgets/WidgetPanel';
import { LeftRail } from '@/components/shell/LeftRail';
import { ManagedContentSlot } from '@/components/widgets/ManagedContentSlot';
import type { IntelligenceEvent } from '@/types/ontology';

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

export function GlanceView() {
  const { incidents: rawIncidents } = useIncidentData();
  const { filtered: incidents } = useFilteredIncidents();
  const events = useAppStore((s) => s.events);
  const assets = useAppStore((s) => s.assets);
  const watchAreas = useAppStore((s) => s.watchAreas);
  const activeLens = useAppStore((s) => s.activeLens);
  const renderingTier = useAppStore((s) => s.renderingTier);
  const currentTime = useAppStore((s) => s.currentTime);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const setInterfaceLevel = useAppStore((s) => s.setInterfaceLevel);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);

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
    <div className={`glance-commercial-layout${sponsorsEnabled ? '' : ' infographic-mode'}`}>

      <section className="glance-priority">
        <LeftRail glanceContent={
          <>
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
          </>
        } />
      </section>

      <main className="glance-map">
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
      </main>

      <aside className="glance-dashboard-summary">
        <WidgetPanel />
      </aside>

      <section className="glance-ad-left" data-placement-location="left-lower-rail">
        <ManagedContentSlot slotKey="LEFT_RAIL_HALF_PAGE" />
      </section>

      <section className="glance-ad-primary glance-ad-primary-split">
        <ManagedContentSlot slotKey="BOTTOM_SECONDARY_BILLBOARD" />
        <ManagedContentSlot slotKey="BOTTOM_PRIMARY_BILLBOARD" />
      </section>

      <section className="glance-ad-secondary-slot">
      </section>

      <section className="glance-ad-right" data-placement-location="right-lower-rail">
        <ManagedContentSlot slotKey="RIGHT_RAIL_HALF_PAGE" />
      </section>

    </div>
  );
}
