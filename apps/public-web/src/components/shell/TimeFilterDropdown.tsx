import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import { describeFilter, todayIsoDay, type TimePreset } from '@/lib/utils/time-filter';

/**
 * Time-period filter for the incident dataset.
 *
 * Reads and writes `timeFilter` / `includeUndated` on the app store. The store
 * is the single writer, `useIncidentData` is the single reader, and every
 * surface that counts, maps or charts incidents inherits the window from the
 * provider — so the map and the dashboard tiles can never disagree.
 *
 * Design notes that are load-bearing, not decoration:
 *  - The trigger ALWAYS states the active window. A filter you cannot see is
 *    indistinguishable from a broken map, and this project has already lost
 *    several rounds to exactly that confusion.
 *  - The year list is built from the data itself (`dataExtent.years`), so a
 *    1990s-2000s import offers 1990s-2000s years and a demo dataset offers 2026.
 *    Nothing is hardcoded to "recent".
 *  - Undated records are included by default and their count is always shown.
 *    A source that states no date is not evidence that the incident falls
 *    outside the window.
 */

const PRESETS: { id: TimePreset; name: string; desc: string }[] = [
  { id: 'last7', name: 'Last 7 days', desc: 'Rolling window ending today' },
  { id: 'last30', name: 'Last 30 days', desc: 'Rolling window ending today' },
  { id: 'last12m', name: 'Last 12 months', desc: 'Rolling window ending today' },
  { id: 'thisYear', name: 'This year', desc: `1 January ${todayIsoDay().slice(0, 4)} to today` },
];

export function TimeFilterDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const timeFilter = useAppStore((s) => s.timeFilter);
  const includeUndated = useAppStore((s) => s.includeUndated);
  const setTimeFilter = useAppStore((s) => s.setTimeFilter);
  const setIncludeUndated = useAppStore((s) => s.setIncludeUndated);

  const { dataExtent, undatedCount, incidents, allIncidents } = useIncidentData();

  // Draft values for the custom range. Kept local so typing a half-finished
  // range does not repeatedly re-filter the whole dataset.
  const [draftFrom, setDraftFrom] = useState(
    timeFilter.mode === 'range' ? (timeFilter.from ?? '') : '',
  );
  const [draftTo, setDraftTo] = useState(
    timeFilter.mode === 'range' ? (timeFilter.to ?? '') : '',
  );

  /**
   * Own outside-click handler. AppShell's handler (AppShell.tsx:93) closes only
   * its own lens and alerts refs and has an empty dependency array, so it can
   * never be made aware of this control from out here.
   */
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  /**
   * Own Escape / arrow handling on the container. AppShell's global keydown
   * handler returns early when the event target is an INPUT or SELECT, so
   * Escape pressed inside the date fields would otherwise never close this
   * panel. `stopPropagation` also stops a stray Escape from closing the command
   * palette at the same time.
   */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('[data-menuitem]') ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown'
      ? items[(i + 1 + items.length) % items.length]
      : items[(i - 1 + items.length) % items.length];
    next?.focus();
  }

  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) {
        // Re-sync the draft from the live filter each time the panel opens, so
        // the fields never show a stale range the user has since replaced.
        setDraftFrom(timeFilter.mode === 'range' ? (timeFilter.from ?? '') : '');
        setDraftTo(timeFilter.mode === 'range' ? (timeFilter.to ?? '') : '');
      }
      return !wasOpen;
    });
  }

  function choose(fn: () => void) {
    fn();
    setOpen(false);
    triggerRef.current?.focus();
  }

  const label = describeFilter(timeFilter);
  const suppressed = Math.max(0, allIncidents.length - incidents.length);

  /**
   * Years offered in the picker: every year present in the data, plus the
   * currently selected year even when nothing in the data falls in it. Without
   * that union a persisted "2000" would render as a blank select and the user
   * could not tell what the control was set to.
   */
  const yearOptions = useMemo(() => {
    const set = new Set<number>(dataExtent?.years ?? []);
    if (timeFilter.mode === 'year') set.add(timeFilter.year);
    return [...set].sort((a, b) => b - a);
  }, [dataExtent, timeFilter]);

  return (
    <div className="lens-selector" ref={containerRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        className="lens-selector-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Filter incidents by when they happened"
        onClick={toggleOpen}
      >
        {label}
        {suppressed > 0 && (
          <span
            className="period-suppressed"
            title={`${suppressed} record${suppressed === 1 ? '' : 's'} hidden by this window — they are counted, not lost`}
          >
            −{suppressed}
          </span>
        )}
        <span style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <div className="lens-dropdown period-dropdown" role="menu">
          <button
            className="lens-option"
            data-menuitem
            role="menuitem"
            data-active={timeFilter.mode === 'all'}
            onClick={() => choose(() => setTimeFilter({ mode: 'all' }))}
          >
            <span className="lens-option-name">All time</span>
            <span className="lens-option-desc">
              {dataExtent
                ? `Everything — ${dataExtent.minDay} to ${dataExtent.maxDay}`
                : 'Everything — no date filter'}
            </span>
          </button>

          <div className="period-group-label">Recent</div>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="lens-option"
              data-menuitem
              role="menuitem"
              data-active={timeFilter.mode === 'preset' && timeFilter.preset === p.id}
              onClick={() => choose(() => setTimeFilter({ mode: 'preset', preset: p.id }))}
            >
              <span className="lens-option-name">{p.name}</span>
              <span className="lens-option-desc">{p.desc}</span>
            </button>
          ))}

          <div className="period-group-label">A specific year</div>
          {yearOptions.length > 0 ? (
            <>
              <div className="period-row">
                <select
                  data-menuitem
                  className="period-input"
                  aria-label="Year"
                  value={timeFilter.mode === 'year' ? String(timeFilter.year) : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Route through choose() like every other option, so picking
                    // a year closes the panel and restores focus to the trigger.
                    // Otherwise the panel sits open over the map, hiding the very
                    // result the user just asked for.
                    if (v) choose(() => setTimeFilter({ mode: 'year', year: Number(v) }));
                  }}
                >
                  <option value="">Choose a year…</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="period-note">
                Only years present in the data are listed
                {dataExtent ? ` (${dataExtent.minYear}–${dataExtent.maxYear}).` : '.'}
                {' '}A record dated only “2000” counts as the whole of 2000.
              </div>
            </>
          ) : (
            <div className="period-note">
              No record carries a usable date yet, so there is no year to pick.
              Use the custom range below, or leave this on All time.
            </div>
          )}

          <div className="period-group-label">Custom range</div>
          <div className="period-row">
            <input
              data-menuitem
              type="date"
              className="period-input"
              aria-label="From date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
            />
            <span className="period-sep" aria-hidden="true">→</span>
            <input
              data-menuitem
              type="date"
              className="period-input"
              aria-label="To date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
            />
          </div>
          <div className="period-row">
            <button
              data-menuitem
              className="period-apply"
              disabled={!draftFrom && !draftTo}
              onClick={() => choose(() => setTimeFilter({
                mode: 'range',
                from: draftFrom || null,
                to: draftTo || null,
              }))}
            >
              Apply range
            </button>
          </div>
          <div className="period-note">
            Both ends are included. Leave either side blank for an open-ended
            window. Dates entered the wrong way round are swapped, not rejected.
          </div>

          {undatedCount > 0 && (
            <>
              <div className="period-divider" />
              <label className="period-check">
                <input
                  data-menuitem
                  type="checkbox"
                  checked={includeUndated}
                  disabled={timeFilter.mode === 'all'}
                  onChange={(e) => setIncludeUndated(e.target.checked)}
                />
                <span>
                  Include {undatedCount} record{undatedCount === 1 ? '' : 's'} with no stated date
                </span>
              </label>
              <div className="period-note">
                {timeFilter.mode === 'all'
                  ? 'Always included under All time.'
                  : 'A source that states no date is not evidence the incident falls outside this window. Included by default.'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
