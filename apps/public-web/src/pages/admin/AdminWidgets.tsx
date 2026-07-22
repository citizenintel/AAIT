import { useAppStore, type WidgetId } from '../../store/app-store';

const WIDGET_LABELS: Record<WidgetId, { label: string; description: string }> = {
  stats_bar: { label: 'Stats bar', description: 'Top bar showing total incidents, critical, deceased, injured, verified, provinces' },
  severity_pie: { label: 'Severity pie chart', description: 'Donut chart breaking down incidents by severity level' },
  module_pie: { label: 'Module pie chart', description: 'Donut chart breaking down incidents by module (AAIT, Unrest, etc.)' },
  verification_pie: { label: 'Verification pie chart', description: 'Donut chart showing verification state distribution' },
  province_bar: { label: 'Province bar chart', description: 'Horizontal bar chart of incidents by province' },
  trend_line: { label: '14-day trend line', description: 'Sparkline showing incident trend over the last two weeks' },
  casualties_card: { label: 'Casualties card', description: 'Deceased and injured totals with per-module breakdown' },
  news_ticker: { label: 'News feed', description: 'Live news ticker at bottom of map showing SA news headlines' },
};

const POSITION_LABELS = { top: 'Top bar', right: 'Right panel', bottom: 'Bottom bar' };

export function AdminWidgets() {
  const { widgets, panelOpen, newsFeedEnabled } = useAppStore((s) => s.widgetState);
  const toggleWidget = useAppStore((s) => s.toggleWidget);
  const setWidgetPosition = useAppStore((s) => s.setWidgetPosition);
  const reorderWidget = useAppStore((s) => s.reorderWidget);
  const setWidgetPanelOpen = useAppStore((s) => s.setWidgetPanelOpen);
  const setNewsFeedEnabled = useAppStore((s) => s.setNewsFeedEnabled);

  const positions = ['top', 'right', 'bottom'] as const;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Widgets & Visualizations</h1>
        <p>Control which stats, charts, and infographics appear on the public map view. Widgets occupy ~30% of the screen alongside the map.</p>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Dashboard panel</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Show/hide the entire widget panel on the public map</p>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={panelOpen} onChange={(e) => setWidgetPanelOpen(e.target.checked)} />
            <span className="toggle-slider" />
            <span className="toggle-label">{panelOpen ? 'Visible' : 'Hidden'}</span>
          </label>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>News feed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Show the live news ticker on the bottom of the map</p>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={newsFeedEnabled} onChange={(e) => setNewsFeedEnabled(e.target.checked)} />
            <span className="toggle-slider" />
            <span className="toggle-label">{newsFeedEnabled ? 'On' : 'Off'}</span>
          </label>
        </div>
      </div>

      {positions.map(pos => {
        const posWidgets = widgets.filter(w => w.position === pos).sort((a, b) => a.order - b.order);
        return (
          <div key={pos} className="admin-card" style={{ marginBottom: 16 }}>
            <h2>{POSITION_LABELS[pos]} widgets</h2>
            <div className="widget-admin-list">
              {posWidgets.map(w => {
                const meta = WIDGET_LABELS[w.id];
                return (
                  <div key={w.id} className={`widget-admin-item${w.enabled ? '' : ' disabled'}`}>
                    <label className="toggle-switch" style={{ flexShrink: 0 }}>
                      <input type="checkbox" checked={w.enabled} onChange={() => toggleWidget(w.id)} />
                      <span className="toggle-slider" />
                    </label>
                    <div className="widget-admin-info">
                      <div className="widget-admin-label">{meta.label}</div>
                      <div className="widget-admin-desc">{meta.description}</div>
                    </div>
                    <div className="widget-admin-controls">
                      <select
                        className="form-input widget-admin-pos"
                        value={w.position}
                        onChange={(e) => setWidgetPosition(w.id, e.target.value as any)}
                      >
                        <option value="top">Top</option>
                        <option value="right">Right</option>
                        <option value="bottom">Bottom</option>
                      </select>
                      <button className="btn btn-small" onClick={() => reorderWidget(w.id, 'up')} title="Move up">↑</button>
                      <button className="btn btn-small" onClick={() => reorderWidget(w.id, 'down')} title="Move down">↓</button>
                    </div>
                  </div>
                );
              })}
              {posWidgets.length === 0 && (
                <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No widgets in this zone</div>
              )}
            </div>
          </div>
        );
      })}

      <div className="admin-note">
        Widget positions and visibility are stored locally during development. In production, these settings sync via the database.
      </div>
    </div>
  );
}
