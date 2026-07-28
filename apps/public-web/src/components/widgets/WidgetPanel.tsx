import { useMemo } from 'react';
import { useAppStore, type WidgetId } from '@/stores/app-store';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '../../data/mock-incidents';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { PieChart } from './PieChart';
import { TrendLine } from './TrendLine';
import { StatsBar } from './StatsBar';
import { NewsTicker } from './NewsTicker';
import { CasualtiesCard } from './CasualtiesCard';
import { ProvinceBar } from './ProvinceBar';
import { ManagedContentSlot, useResolvedContentSlot } from './ManagedContentSlot';

function WidgetRenderer({ id }: { id: WidgetId }) {
  const { incidents } = useIncidentData();
  const severitySlices = useMemo(() =>
    Object.entries(SEVERITY_META).map(([key, meta]) => ({
      label: meta.label,
      value: incidents.filter(i => i.severity === key).length,
      colour: meta.colour,
    })), [incidents]);

  const moduleSlices = useMemo(() =>
    Object.entries(MODULE_META).map(([key, meta]) => ({
      label: meta.label,
      value: incidents.filter(i => i.module === key).length,
      colour: meta.colour,
    })), [incidents]);

  const verificationSlices = useMemo(() => {
    const groups: Record<string, { label: string; colour: string; count: number }> = {
      unverified: { label: 'Unverified', colour: '#718096', count: 0 },
      plausible: { label: 'Plausible', colour: '#ecc94b', count: 0 },
      corroborated: { label: 'Corroborated', colour: '#4299e1', count: 0 },
      verified: { label: 'Verified', colour: '#48bb78', count: 0 },
    };
    for (const inc of incidents) {
      if (inc.verification.startsWith('v0') || inc.verification.startsWith('v1')) groups.unverified!.count++;
      else if (inc.verification.startsWith('v2')) groups.plausible!.count++;
      else if (inc.verification.startsWith('v3')) groups.corroborated!.count++;
      else groups.verified!.count++;
    }
    return Object.values(groups).map(g => ({ label: g.label, value: g.count, colour: g.colour }));
  }, [incidents]);

  switch (id) {
    case 'stats_bar': return <StatsBar />;
    case 'severity_pie': return <PieChart slices={severitySlices} title="By severity" size={110} />;
    case 'module_pie': return <PieChart slices={moduleSlices} title="By module" size={110} />;
    case 'verification_pie': return <PieChart slices={verificationSlices} title="Verification" size={110} />;
    case 'province_bar': return <ProvinceBar />;
    case 'trend_line': return <TrendLine />;
    case 'news_ticker': return <NewsTicker />;
    case 'casualties_card': return <CasualtiesCard />;
    default: return null;
  }
}

export function WidgetPanel() {
  const { widgets, panelOpen, newsFeedEnabled } = useAppStore((s) => s.widgetState);
  const setWidgetPanelOpen = useAppStore((s) => s.setWidgetPanelOpen);

  const topWidgets = widgets.filter(w => w.enabled && w.position === 'top').sort((a, b) => a.order - b.order);
  const rightWidgets = widgets.filter(w => w.enabled && w.position === 'right').sort((a, b) => a.order - b.order);
  const bottomWidgets = widgets.filter(w => w.enabled && w.position === 'bottom' && (w.id !== 'news_ticker' || newsFeedEnabled)).sort((a, b) => a.order - b.order);

  if (!panelOpen) {
    return (
      <button className="widget-panel-toggle collapsed" onClick={() => setWidgetPanelOpen(true)} title="Show dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {topWidgets.length > 0 && (
        <div className="widget-zone-top">
          {topWidgets.map(w => <WidgetRenderer key={w.id} id={w.id} />)}
        </div>
      )}

      {rightWidgets.length > 0 && (
        <div className="widget-zone-right">
          <div className="widget-zone-header">
            <span>Dashboard</span>
            <button className="widget-zone-close" onClick={() => setWidgetPanelOpen(false)} title="Hide dashboard">×</button>
          </div>
          <div className="widget-zone-scroll">
            {rightWidgets.map((w) => (
              <div key={w.id} className="widget-card">
                <WidgetRenderer id={w.id} />
              </div>
            ))}
            <ManagedContentSlot slotKey="RIGHT_DASHBOARD_RECTANGLE" />
          </div>
        </div>
      )}

      {bottomWidgets.length > 0 && (
        <div className="widget-zone-bottom">
          {bottomWidgets.map(w => <WidgetRenderer key={w.id} id={w.id} />)}
        </div>
      )}
    </>
  );
}
