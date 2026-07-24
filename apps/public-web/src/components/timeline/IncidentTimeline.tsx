'use client';

import { formatDistanceToNow } from 'date-fns';
import type { TimelineEntry } from '@/types/ontology';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IncidentTimelineProps {
  entries: TimelineEntry[];
}

export default function IncidentTimeline({ entries }: IncidentTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="incident-timeline" style={{ padding: 'var(--sp-4)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
        No timeline entries yet.
      </div>
    );
  }

  return (
    <div className="incident-timeline">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;
        const timestamp = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);

        return (
          <div className="timeline-entry" key={idx}>
            {/* Rail: dot + connecting line */}
            <div className="timeline-rail">
              <div className="timeline-dot" data-type={entry.type} />
              {!isLast && <div className="timeline-line" />}
            </div>

            {/* Body */}
            <div className="timeline-body">
              <div className="timeline-header">
                <span className="timeline-time">
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </span>
                <span className="timeline-type">{entry.type}</span>
                {entry.confidenceChange !== 0 && (
                  <span
                    className="timeline-confidence-change"
                    style={{
                      color:
                        entry.confidenceChange > 0
                          ? 'var(--status-low)'
                          : 'var(--status-critical)',
                    }}
                  >
                    {entry.confidenceChange > 0 ? '+' : ''}
                    {entry.confidenceChange}
                  </span>
                )}
              </div>

              <div className="timeline-summary">{entry.summary}</div>

              <div className="timeline-source">Source: {entry.source}</div>

              {entry.previousBelief && (
                <div className="timeline-prev-belief">
                  Previously believed: {entry.previousBelief}
                </div>
              )}

              {entry.locationChange && (
                <div className="timeline-location-change">
                  {'\u{1F4CD}'} Location narrowed: {entry.locationChange.previousRadiusKm}km{' '}
                  &rarr; {entry.locationChange.newRadiusKm}km
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
