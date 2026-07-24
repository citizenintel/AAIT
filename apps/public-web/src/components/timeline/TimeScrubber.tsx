import { useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { useAppStore } from '@/stores/app-store';

// ---------------------------------------------------------------------------
// Speed steps
// ---------------------------------------------------------------------------

const SPEED_STEPS = [1, 2, 5, 10] as const;

function nextSpeed(current: number): number {
  const idx = SPEED_STEPS.indexOf(current as (typeof SPEED_STEPS)[number]);
  if (idx === -1 || idx === SPEED_STEPS.length - 1) return SPEED_STEPS[0]!;
  return SPEED_STEPS[idx + 1]!;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeScrubber() {
  const currentTime = useAppStore((s) => s.currentTime);
  const timeRange = useAppStore((s) => s.timeRange);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const play = useAppStore((s) => s.play);
  const pause = useAppStore((s) => s.pause);
  const setSpeed = useAppStore((s) => s.setSpeed);

  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // ------------------------------------------------------------------
  // Position calculation
  // ------------------------------------------------------------------
  const rangeMs = timeRange.end.getTime() - timeRange.start.getTime();
  const currentMs = currentTime.getTime() - timeRange.start.getTime();
  const fraction = rangeMs > 0 ? Math.max(0, Math.min(1, currentMs / rangeMs)) : 0;

  // ------------------------------------------------------------------
  // Resolve a clientX to a Date within the time range
  // ------------------------------------------------------------------
  const clientXToTime = useCallback(
    (clientX: number): Date => {
      const track = trackRef.current;
      if (!track) return currentTime;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ms = timeRange.start.getTime() + pct * rangeMs;
      return new Date(ms);
    },
    [currentTime, timeRange, rangeMs],
  );

  // ------------------------------------------------------------------
  // Mouse interaction on the track
  // ------------------------------------------------------------------
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      setCurrentTime(clientXToTime(e.clientX));
    },
    [clientXToTime, setCurrentTime],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      setCurrentTime(clientXToTime(e.clientX));
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clientXToTime, setCurrentTime]);

  // ------------------------------------------------------------------
  // Playback interval
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const next = new Date(
        useAppStore.getState().currentTime.getTime() +
          useAppStore.getState().playbackSpeed * 60_000,
      );
      // Clamp to end of range
      if (next.getTime() >= timeRange.end.getTime()) {
        setCurrentTime(timeRange.end);
        pause();
      } else {
        setCurrentTime(next);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, timeRange.end, setCurrentTime, pause]);

  // ------------------------------------------------------------------
  // Formatted time display
  // ------------------------------------------------------------------
  let formattedTime: string;
  try {
    formattedTime = format(currentTime, 'dd MMM yyyy HH:mm');
  } catch {
    formattedTime = currentTime.toISOString();
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="time-scrubber">
      {/* Controls: play/pause, speed */}
      <div className="time-scrubber-controls">
        <button
          className="time-scrubber-btn"
          onClick={() => (isPlaying ? pause() : play())}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <span
          className="time-scrubber-speed"
          onClick={() => setSpeed(nextSpeed(playbackSpeed))}
          title="Click to cycle playback speed"
        >
          {playbackSpeed}x
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="time-scrubber-track"
        onMouseDown={handleMouseDown}
      >
        <div
          className="time-scrubber-fill"
          style={{ width: `${fraction * 100}%` }}
        />
        <div
          className="time-scrubber-thumb"
          style={{ left: `${fraction * 100}%` }}
        />
      </div>

      {/* Current time readout */}
      <span className="time-scrubber-time">{formattedTime}</span>
    </div>
  );
}
