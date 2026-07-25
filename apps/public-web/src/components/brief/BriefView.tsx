import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { IntelligenceMap } from '@/components/map/IntelligenceMap';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import type { IntelligenceEvent } from '@/types/ontology';

interface Chapter {
  title: string;
  narrative: string;
  center: [number, number];
  zoom: number;
  highlightedEventIds: string[];
  durationSeconds: number;
}

const AUDIENCES = [
  'Community', 'Journalist', 'Insurer', 'Researcher',
  'Municipal Official', 'Security Organization', 'Legal Professional',
];

function buildChapters(events: IntelligenceEvent[]): Chapter[] {
  if (events.length === 0) return [];

  const chapters: Chapter[] = [
    {
      title: 'National Overview',
      narrative: `${events.length} intelligence events tracked across South Africa. The platform aggregates data from multiple independent sources, cross-references claims, and surfaces what has changed — not just what exists.`,
      center: [25.5, -28.0],
      zoom: 5.5,
      highlightedEventIds: events.map((e) => e.id),
      durationSeconds: 8,
    },
  ];

  const active = events.filter((e) => e.status === 'active' || e.status === 'developing');
  const critical = active.filter((e) => {
    const change = e.changeFromBaseline;
    return change && (change.changeFromWeekBaseline > 100 || change.isFirstOccurrence);
  });

  for (const evt of critical.slice(0, 4)) {
    chapters.push({
      title: evt.title,
      narrative: evt.description,
      center: [evt.location.longitude, evt.location.latitude],
      zoom: 9,
      highlightedEventIds: [evt.id, ...evt.relatedEvents],
      durationSeconds: 10,
    });
  }

  if (chapters.length > 1) {
    chapters.push({
      title: 'Situation Assessment',
      narrative: `${critical.length} critical developments require attention. ${active.length} events are currently active or developing. The attention engine has ranked these by change from baseline, not raw count — surfacing what is different, not what is normal.`,
      center: [25.5, -28.0],
      zoom: 5.5,
      highlightedEventIds: [],
      durationSeconds: 8,
    });
  }

  return chapters;
}

export function BriefView() {
  const { incidents } = useIncidentData();
  const events = useAppStore((s) => s.events);
  const assets = useAppStore((s) => s.assets);
  const activeLens = useAppStore((s) => s.activeLens);
  const renderingTier = useAppStore((s) => s.renderingTier);
  const currentTime = useAppStore((s) => s.currentTime);
  const selectEvent = useAppStore((s) => s.selectEvent);

  const [currentChapter, setCurrentChapter] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audience, setAudience] = useState('Community');

  const eventArray = useMemo(() => Array.from(events.values()), [events]);
  const assetArray = useMemo(() => Array.from(assets.values()), [assets]);
  const chapters = useMemo(() => buildChapters(eventArray), [eventArray]);

  const chapter = chapters[currentChapter];

  const goNext = useCallback(() => {
    setCurrentChapter((c) => Math.min(c + 1, chapters.length - 1));
  }, [chapters.length]);

  const goPrev = useCallback(() => {
    setCurrentChapter((c) => Math.max(c - 1, 0));
  }, []);

  useEffect(() => {
    if (!isPlaying || !chapter) return;
    const timer = setTimeout(() => {
      if (currentChapter < chapters.length - 1) {
        goNext();
      } else {
        setIsPlaying(false);
      }
    }, chapter.durationSeconds * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, currentChapter, chapter, chapters.length, goNext]);

  const highlightedId = chapter?.highlightedEventIds[0] ?? null;

  const exportBrief = useCallback(() => {
    if (chapters.length === 0) return;
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const lines = [
      `INTELLIGENCE TWIN — BRIEFING`,
      `Audience: ${audience}`,
      `Generated: ${now}`,
      `Chapters: ${chapters.length}`,
      '',
      ...chapters.map((ch, i) => [
        `--- Chapter ${i + 1}: ${ch.title} ---`,
        ch.narrative,
        '',
      ]).flat(),
      `--- END OF BRIEFING ---`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `briefing-${audience.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chapters, audience]);

  if (chapters.length === 0) {
    return (
      <div className="brief-view">
        <div className="brief-canvas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-2)' }}>No data for briefing</div>
            <div style={{ fontSize: 'var(--text-sm)' }}>Load events to generate a presentation briefing.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="brief-view">
      <div className="brief-canvas">
        <IntelligenceMap
          events={eventArray}
          assets={assetArray}
          incidents={incidents}
          renderingTier={renderingTier}
          activeLens={activeLens}
          selectedEventId={highlightedId}
          onEventSelect={selectEvent}
          currentTime={currentTime}
          flyToCenter={chapter?.center}
          flyToZoom={chapter?.zoom}
        />

        {chapter && (
          <div className="brief-story-overlay">
            <div className="brief-story-title">{chapter.title}</div>
            <div className="brief-story-narrative">{chapter.narrative}</div>
          </div>
        )}
      </div>

      <div className="brief-controls">
        <button
          className="time-scrubber-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button className="time-scrubber-btn" onClick={goPrev} disabled={currentChapter === 0}>
          ◀
        </button>
        <button className="time-scrubber-btn" onClick={goNext} disabled={currentChapter === chapters.length - 1}>
          ▶
        </button>

        <div className="brief-progress-dots">
          {chapters.map((_, i) => (
            <div
              key={i}
              className="brief-progress-dot"
              data-active={i === currentChapter}
              onClick={() => setCurrentChapter(i)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          style={{
            background: 'var(--surface-3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)', padding: '4px 8px', fontFamily: 'var(--font-body)',
          }}
        >
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <button
          className="time-scrubber-btn"
          style={{ width: 'auto', padding: '0 var(--sp-3)', fontSize: 'var(--text-xs)' }}
          title="Export Report"
          onClick={exportBrief}
        >
          Export
        </button>
      </div>
    </div>
  );
}
