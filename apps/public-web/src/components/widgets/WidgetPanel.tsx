import React, { useMemo } from 'react';
import { useAppStore, type WidgetId } from '@/stores/app-store';
import { MODULE_META, SEVERITY_META } from '../../data/mock-incidents';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { PieChart } from './PieChart';
import { StatsBar } from './StatsBar';
import { ProvinceBar } from './ProvinceBar';

const SUMMARY_WIDGETS: WidgetId[] = ['stats_bar', 'severity_pie', 'module_pie', 'province_bar'];

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

  switch (id) {
    case 'stats_bar': return <StatsBar />;
    case 'severity_pie': return <PieChart slices={severitySlices} title="By severity" size={110} />;
    case 'module_pie': return <PieChart slices={moduleSlices} title="By module" size={110} />;
    case 'province_bar': return <ProvinceBar />;
    default: return null;
  }
}

export function WidgetPanel() {
  const { widgets, panelOpen } = useAppStore((s) => s.widgetState);
  const setWidgetPanelOpen = useAppStore((s) => s.setWidgetPanelOpen);

  const summaryWidgets = widgets
    .filter(w => w.enabled && SUMMARY_WIDGETS.includes(w.id))
    .sort((a, b) => a.order - b.order);

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
    <div className="widget-zone-right">
      <div className="widget-zone-header">
        <span>Dashboard</span>
        <button className="widget-zone-close" onClick={() => setWidgetPanelOpen(false)} title="Hide dashboard">×</button>
      </div>
      <div className="widget-zone-scroll">
        {summaryWidgets.map((w) => (
          <div key={w.id} className="widget-card">
            <WidgetRenderer id={w.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
