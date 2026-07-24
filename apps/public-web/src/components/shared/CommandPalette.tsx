import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/app-store';
import { processQuery } from '@/lib/ai-director';
import type { AIAction } from '@/types/ontology';

interface CommandAction {
  id: number;
  description: string;
  actions?: AIAction[];
  relatedEventIds?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const events = useAppStore((s) => s.events);
  const assets = useAppStore((s) => s.assets);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const setInterfaceLevel = useAppStore((s) => s.setInterfaceLevel);

  const [query, setQuery] = useState('');
  const [actions, setActions] = useState<CommandAction[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);

  const eventArray = useMemo(() => Array.from(events.values()), [events]);
  const assetArray = useMemo(() => Array.from(assets.values()), [assets]);

  // ------------------------------------------------------------------
  // Close the palette
  // ------------------------------------------------------------------
  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery('');
    setActions([]);
  }, [setCommandPaletteOpen]);

  // ------------------------------------------------------------------
  // Focus input when opened
  // ------------------------------------------------------------------
  useEffect(() => {
    if (commandPaletteOpen) {
      // Small delay so the DOM has rendered
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [commandPaletteOpen]);

  // ------------------------------------------------------------------
  // Escape key closes the palette
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!commandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, close]);

  // ------------------------------------------------------------------
  // Parse the query and build actions
  // ------------------------------------------------------------------
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;

      const result = processQuery(q, { events: eventArray, assets: assetArray });

      idCounter.current += 1;
      const action: CommandAction = {
        id: idCounter.current,
        description: result.answer,
        actions: result.actions,
        relatedEventIds: result.relatedEventIds,
      };

      setActions((prev) => [action, ...prev]);
      setQuery('');

      if (result.relatedEventIds.length === 1) {
        selectEvent(result.relatedEventIds[0]!);
        setInterfaceLevel('investigate');
      }
    },
    [query, eventArray, assetArray, selectEvent, setInterfaceLevel],
  );

  // ------------------------------------------------------------------
  // Don't render if closed
  // ------------------------------------------------------------------
  if (!commandPaletteOpen) return null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="command-palette-overlay" onClick={close}>
      <div
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            placeholder="Ask anything or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        {actions.length > 0 && (
          <div className="command-palette-actions">
            {actions.map((action) => (
              <div key={action.id} className="command-action">
                <span className="command-action-desc">
                  {action.description}
                </span>
                {action.actions && action.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)', flexWrap: 'wrap' }}>
                    {action.actions.map((a, i) => (
                      <span key={i} style={{
                        fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-muted)', color: 'var(--accent)',
                      }}>
                        {a.description}
                      </span>
                    ))}
                  </div>
                )}
                {action.relatedEventIds && action.relatedEventIds.length > 0 && action.relatedEventIds.length <= 5 && (
                  <div style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)', flexWrap: 'wrap' }}>
                    {action.relatedEventIds.map((eid) => {
                      const evt = events.get(eid);
                      if (!evt) return null;
                      return (
                        <span
                          key={eid}
                          onClick={() => { selectEvent(eid); setInterfaceLevel('investigate'); close(); }}
                          style={{
                            fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface-3)', color: 'var(--accent)', cursor: 'pointer',
                          }}
                        >
                          {evt.title.length > 30 ? evt.title.slice(0, 27) + '...' : evt.title}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
