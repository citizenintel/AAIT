import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/stores/app-store';
import { IntelligenceMap } from '@/components/map/IntelligenceMap';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import ConfidenceAnatomy from '@/components/shared/ConfidenceAnatomy';
import IncidentTimeline from '@/components/timeline/IncidentTimeline';
import ConsequenceTree from '@/components/shared/ConsequenceTree';
import NarrativeDivergenceView from '@/components/shared/NarrativeDivergence';
import { TimeScrubber } from '@/components/timeline/TimeScrubber';
import { RelationshipGraph } from '@/components/graph/RelationshipGraph';
import { analyzeConsequences } from '@/lib/consequence-engine';
import { detectChanges } from '@/lib/attention-engine';
import { MOCK_DIVERGENCE } from '@/data/mock-divergence';
import type { IntelligenceEvent } from '@/types/ontology';

type PanelTab = 'detail' | 'timeline' | 'sources' | 'cascade' | 'narrative';

const CHANGE_FILTERS = [
  { type: 'new' as const, label: 'New this hour', timeframe: 'hour' as const },
  { type: 'escalated' as const, label: 'Escalating', timeframe: 'day' as const },
  { type: 'first_occurrence' as const, label: 'First occurrence', timeframe: 'week' as const },
  { type: 'stopped_reporting' as const, label: 'Stopped reporting', timeframe: 'day' as const },
  { type: 'revised' as const, label: 'Evidence revised', timeframe: 'day' as const },
];

const SOURCE_TYPE_ICONS: Record<string, string> = {
  official: '🏛️', community: '👥', national_media: '📰', international_media: '🌍',
  industry: '🏭', social_media: '📱', sensor: '📡', academic: '🎓',
};

export function InvestigateView() {
  const { incidents } = useIncidentData();
  const [activeTab, setActiveTab] = useState<PanelTab>('detail');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'map' | 'graph'>('map');

  const events = useAppStore((s) => s.events);
  const assets = useAppStore((s) => s.assets);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const activeLens = useAppStore((s) => s.activeLens);
  const renderingTier = useAppStore((s) => s.renderingTier);
  const currentTime = useAppStore((s) => s.currentTime);

  const eventArray = useMemo(() => Array.from(events.values()), [events]);
  const assetArray = useMemo(() => Array.from(assets.values()), [assets]);
  const selectedEvent = selectedEventId ? events.get(selectedEventId) ?? null : null;

  const filteredEvents = useMemo(() => {
    if (!activeFilter) return eventArray;
    const filter = CHANGE_FILTERS.find((f) => f.type === activeFilter);
    if (!filter) return eventArray;
    return detectChanges(eventArray, { timeframe: filter.timeframe, type: filter.type });
  }, [eventArray, activeFilter]);

  const changeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of CHANGE_FILTERS) {
      counts[f.type] = detectChanges(eventArray, { timeframe: f.timeframe, type: f.type }).length;
    }
    return counts;
  }, [eventArray]);

  const cascadeAnalysis = useMemo(() => {
    if (!selectedEvent || selectedEvent.relatedAssets.length === 0) return null;
    const firstAssetId = selectedEvent.relatedAssets[0]!;
    return analyzeConsequences(firstAssetId, assets, 4);
  }, [selectedEvent, assets]);

  const divergence = selectedEvent?.id === 'evt-003' ? MOCK_DIVERGENCE : null;

  return (
    <div className="investigate-view">
      <div className="investigate-map">
        <div style={{
          position: 'absolute', top: 'var(--sp-2)', right: 'var(--sp-2)', zIndex: 10,
          display: 'flex', gap: 'var(--sp-1)',
        }}>
          {(['map', 'graph'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMapMode(m)}
              style={{
                padding: '3px 8px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                background: mapMode === m ? 'var(--accent-muted)' : 'var(--surface-2)',
                color: mapMode === m ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {m === 'map' ? 'Map' : 'Graph'}
            </button>
          ))}
        </div>
        {mapMode === 'map' ? (
          <IntelligenceMap
            events={filteredEvents}
            assets={assetArray}
            incidents={incidents}
            renderingTier={renderingTier}
            activeLens={activeLens}
            selectedEventId={selectedEventId}
            onEventSelect={selectEvent}
            currentTime={currentTime}
          />
        ) : (
          <RelationshipGraph
            events={filteredEvents}
            assets={assetArray}
            onEventSelect={selectEvent}
            onAssetSelect={(id) => selectEvent(id)}
          />
        )}
      </div>

      <div className="investigate-panel">
        <div className="panel-tabs">
          {(['detail', 'timeline', 'sources', 'cascade', 'narrative'] as PanelTab[]).map((tab) => (
            <button
              key={tab}
              className="panel-tab"
              data-active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="panel-content">
          {!selectedEvent ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-2)' }}>
                Select an event
              </div>
              <div style={{ fontSize: 'var(--text-sm)' }}>
                Click a marker on the map or a priority card to investigate.
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'detail' && <DetailTab event={selectedEvent} eventArray={eventArray} onSelect={selectEvent} />}
              {activeTab === 'timeline' && <IncidentTimeline entries={selectedEvent.timeline} />}
              {activeTab === 'sources' && <SourcesTab event={selectedEvent} />}
              {activeTab === 'cascade' && <ConsequenceTree analysis={cascadeAnalysis} />}
              {activeTab === 'narrative' && <NarrativeDivergenceView divergence={divergence} />}
            </>
          )}
        </div>
      </div>

      <div className="investigate-bottom">
        <TimeScrubber />
        <div className="change-quick-actions">
          {CHANGE_FILTERS.map((f) => (
            <button
              key={f.type}
              className="change-action-btn"
              data-active={activeFilter === f.type}
              onClick={() => setActiveFilter(activeFilter === f.type ? null : f.type)}
            >
              {f.label}
              <span className="change-action-count">{changeCounts[f.type] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailTab({
  event,
  eventArray,
  onSelect,
}: {
  event: IntelligenceEvent;
  eventArray: IntelligenceEvent[];
  onSelect: (id: string | null) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, lineHeight: 1.3 }}>
        {event.title}
      </h3>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-3)', color: 'var(--text-secondary)',
        }}>
          {event.type.replace(/_/g, ' ')}
        </span>
        <span style={{
          fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          background: event.status === 'active' ? 'rgba(239,68,68,0.1)' : 'var(--surface-3)',
          color: event.status === 'active' ? 'var(--status-critical)' : 'var(--text-secondary)',
        }}>
          {event.status}
        </span>
      </div>

      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        {event.location.placeName}, {event.location.province}
        <span style={{ color: 'var(--text-tertiary)', marginLeft: 'var(--sp-2)' }}>
          ±{event.location.radiusKm}km
        </span>
      </div>

      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
        {formatDistanceToNow(event.timestamp, { addSuffix: true })}
      </div>

      <ConfidenceAnatomy confidence={event.confidence} mode="full" />

      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {event.description}
      </div>

      {event.relatedEvents.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--sp-2)' }}>
            Related Events
          </div>
          {event.relatedEvents.map((relId) => {
            const rel = eventArray.find((e) => e.id === relId);
            if (!rel) return null;
            return (
              <div
                key={relId}
                onClick={() => onSelect(relId)}
                style={{
                  padding: 'var(--sp-2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: 'var(--text-sm)', color: 'var(--accent)',
                  transition: 'background var(--ease-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {rel.title}
              </div>
            );
          })}
        </div>
      )}

      {event.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
          {event.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', color: 'var(--text-tertiary)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SourcesTab({ event }: { event: IntelligenceEvent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {event.sources.length} Source{event.sources.length !== 1 ? 's' : ''}
      </div>

      {event.sources.map((src, i) => (
        <div
          key={i}
          style={{
            padding: 'var(--sp-3)', background: 'var(--surface-2)',
            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span>{SOURCE_TYPE_ICONS[src.sourceType] ?? '📄'}</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
              {src.title}
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            Published: {formatDistanceToNow(src.publishedAt, { addSuffix: true })}
            {' · '}
            Retrieved: {formatDistanceToNow(src.retrievedAt, { addSuffix: true })}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
            "{src.quotation}"
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Confidence contribution</span>
            <div className="confidence-bar-track" style={{ width: 80 }}>
              <div
                className="confidence-bar-fill"
                data-range={src.confidenceContribution >= 80 ? 'high' : src.confidenceContribution >= 50 ? 'medium' : 'low'}
                style={{ width: `${src.confidenceContribution}%` }}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
              {src.confidenceContribution}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
