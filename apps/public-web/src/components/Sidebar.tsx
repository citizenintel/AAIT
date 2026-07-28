import { useState, useMemo } from 'react';
import { useAppStore } from '../store/app-store';
import { MODULE_META } from '../data/mock-incidents';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import type { ModuleKey } from '../data/types';

interface LayerItem {
  id: string;
  label: string;
  categories: string[];
}

const LAYER_GROUPS: { id: ModuleKey; items: LayerItem[] }[] = [
  {
    id: 'ait',
    items: [
      { id: 'farm_attack', label: 'Farm attacks', categories: ['farm_attack'] },
      { id: 'farm_murder', label: 'Farm murders', categories: ['farm_murder'] },
      { id: 'smallholding_attack', label: 'Smallholding attacks', categories: ['smallholding_attack'] },
      { id: 'livestock_theft', label: 'Livestock theft', categories: ['livestock_theft'] },
      { id: 'rural_road_attack', label: 'Rural road attacks', categories: ['rural_road_attack'] },
      { id: 'land_invasion', label: 'Land invasion', categories: ['land_invasion'] },
    ],
  },
  {
    id: 'unrest',
    items: [
      { id: 'protest', label: 'Protests', categories: ['peaceful_protest', 'disruptive_protest', 'violent_protest', 'service_delivery_protest', 'university_protest'] },
      { id: 'riot', label: 'Riots', categories: ['riot'] },
      { id: 'looting', label: 'Looting', categories: ['looting'] },
      { id: 'taxi_violence', label: 'Taxi violence', categories: ['taxi_violence'] },
      { id: 'political_violence', label: 'Political violence', categories: ['political_violence'] },
    ],
  },
  {
    id: 'bias',
    items: [
      { id: 'bias_indicators', label: 'Bias indicators reported', categories: ['bias_indicators'] },
      { id: 'hate_speech', label: 'Hate speech', categories: ['hate_speech'] },
    ],
  },
  {
    id: 'infrastructure',
    items: [
      { id: 'electricity_disruption', label: 'Electricity disruption', categories: ['electricity_disruption'] },
      { id: 'water_disruption', label: 'Water disruption', categories: ['water_disruption'] },
      { id: 'telecom_outage', label: 'Telecom outage', categories: ['telecom_outage'] },
    ],
  },
  {
    id: 'natural',
    items: [
      { id: 'fire', label: 'Fire', categories: ['fire'] },
      { id: 'flood', label: 'Flood', categories: ['flood'] },
      { id: 'drought', label: 'Drought', categories: ['drought'] },
    ],
  },
  {
    id: 'traffic',
    items: [
      { id: 'road_accident', label: 'Road accidents', categories: ['road_accident'] },
      { id: 'road_closure', label: 'Road closures', categories: ['road_closure'] },
    ],
  },
];

export function Sidebar() {
  const { incidents } = useIncidentData();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['ait']));
  const modules = useAppStore((s) => s.filters.modules);
  const categories = useAppStore((s) => s.filters.categories);
  const setModuleFilter = useAppStore((s) => s.setModuleFilter);
  const setCategoryFilter = useAppStore((s) => s.setCategoryFilter);

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inc of incidents) {
      counts[inc.module] = (counts[inc.module] ?? 0) + 1;
    }
    return counts;
  }, [incidents]);

  const infographics = useMemo(() => {
    const active = incidents.filter((inc) => modules[inc.module]);
    const byCat: Record<string, number> = {};
    const bySev: Record<string, number> = {};
    for (const inc of active) {
      byCat[inc.category] = (byCat[inc.category] ?? 0) + 1;
      bySev[inc.severity] = (bySev[inc.severity] ?? 0) + 1;
    }
    const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = topCats[0]?.[1] ?? 1;
    const sevOrder = ['critical', 'high', 'medium', 'low'] as const;
    const sevColours: Record<string, string> = { critical: '#c53030', high: '#dd6b20', medium: '#d69e2e', low: '#3182ce' };
    const sevData = sevOrder.map((k) => ({ key: k, count: bySev[k] ?? 0, colour: sevColours[k] ?? '#718096' })).filter((s) => s.count > 0);
    return { topCats, maxCat, sevData, total: active.length };
  }, [incidents, modules]);

  const fmtCat = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  // "The Last 24 Hours" summary — reflects the modules currently switched on.
  const summary = useMemo(() => {
    const active = incidents.filter((inc) => modules[inc.module]);
    let deceased = 0, injured = 0, critical = 0, verified = 0;
    const byProvince: Record<string, number> = {};
    for (const inc of active) {
      if (inc.severity === 'critical') critical += 1;
      if (inc.verification.startsWith('v3') || inc.verification.startsWith('v4') || inc.verification.startsWith('v5')) verified += 1;
      deceased += inc.casualties?.deceased ?? 0;
      injured += inc.casualties?.injured ?? 0;
      byProvince[inc.province] = (byProvince[inc.province] ?? 0) + 1;
    }
    const topProvinces = Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const maxProv = topProvinces[0]?.[1] ?? 1;
    return { total: active.length, critical, deceased, injured, verified, topProvinces, maxProv };
  }, [incidents, modules]);

  const verifiedPct = summary.total > 0 ? Math.round((summary.verified / summary.total) * 100) : 0;

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModule = (id: ModuleKey, e: React.MouseEvent) => {
    e.stopPropagation();
    setModuleFilter(id, !modules[id]);
  };

  const isCategoryActive = (catId: string): boolean => {
    return categories[catId] !== false;
  };

  const toggleCategory = (catId: string) => {
    setCategoryFilter(catId, !isCategoryActive(catId));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">Layers</div>
      {LAYER_GROUPS.map(group => {
        const meta = MODULE_META[group.id];
        const count = moduleCounts[group.id] ?? 0;
        const isModuleOn = modules[group.id];

        return (
          <div key={group.id} className={`layer-group${openGroups.has(group.id) ? ' open' : ''}${!isModuleOn ? ' disabled' : ''}`}>
            <div className="layer-group-header" onClick={() => toggleGroup(group.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={`layer-toggle module-toggle${isModuleOn ? ' active' : ''}`}
                  onClick={(e) => toggleModule(group.id, e)}
                  role="switch"
                  aria-checked={isModuleOn}
                  tabIndex={0}
                />
                <span className="layer-group-dot" style={{ background: meta.colour }} />
                {meta.label}
              </div>
              <span className="layer-group-count">{isModuleOn ? count : '—'}</span>
            </div>
            <div className="layer-group-items">
              {group.items.map(item => (
                <label key={item.id} className="layer-item" onClick={() => toggleCategory(item.id)}>
                  <span className={`layer-toggle${isCategoryActive(item.id) ? ' active' : ''}`} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {infographics.topCats.length > 0 && (
        <div className="sidebar-infographics">
          <div className="sidebar-infographics-title">Incident Breakdown</div>
          <div className="infographic-cats">
            {infographics.topCats.map(([cat, count]) => (
              <div key={cat} className="infographic-cat-row">
                <span className="infographic-cat-name">{fmtCat(cat)}</span>
                <span className="infographic-cat-bar"><span style={{ width: `${(count / infographics.maxCat) * 100}%` }} /></span>
                <span className="infographic-cat-count">{count}</span>
              </div>
            ))}
          </div>
          {infographics.sevData.length > 0 && (
            <div className="infographic-severity">
              <div className="infographic-sev-track">
                {infographics.sevData.map((s) => (
                  <div key={s.key} className="infographic-sev-segment" style={{ width: `${(s.count / infographics.total) * 100}%`, background: s.colour }} title={`${s.key}: ${s.count}`} />
                ))}
              </div>
              <div className="infographic-sev-legend">
                {infographics.sevData.map((s) => (
                  <span key={s.key}><span className="infographic-sev-dot" style={{ background: s.colour }} />{s.count} {s.key}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-summary">
        <div className="sidebar-summary-title">The Last 24 Hours</div>
        <div className="summary-grid">
          <div className="summary-cell">
            <div className="summary-value">{summary.total}</div>
            <div className="summary-label">Incidents</div>
          </div>
          <div className="summary-cell critical">
            <div className="summary-value">{summary.critical}</div>
            <div className="summary-label">Critical</div>
          </div>
          <div className="summary-cell">
            <div className="summary-value">{summary.deceased}</div>
            <div className="summary-label">Deceased</div>
          </div>
          <div className="summary-cell">
            <div className="summary-value">{summary.injured}</div>
            <div className="summary-label">Injured</div>
          </div>
        </div>

        <div className="summary-verified">
          <div className="summary-verified-head">
            <span>Corroborated or verified</span>
            <span>{verifiedPct}%</span>
          </div>
          <div className="summary-verified-track"><div className="summary-verified-fill" style={{ width: `${verifiedPct}%` }} /></div>
        </div>

        {summary.topProvinces.length > 0 && (
          <div className="summary-provinces">
            <div className="summary-provinces-title">Most active provinces</div>
            {summary.topProvinces.map(([prov, n]) => (
              <div key={prov} className="summary-prov-row">
                <span className="summary-prov-name">{prov}</span>
                <span className="summary-prov-bar"><span style={{ width: `${(n / summary.maxProv) * 100}%` }} /></span>
                <span className="summary-prov-count">{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer-note">
        <strong>Mapped. Sourced. Reviewed.</strong> What the statistics refuse to count.
        <span className="sidebar-footer-sub">All data synthetic · sources last checked —</span>
      </div>
    </aside>
  );
}
