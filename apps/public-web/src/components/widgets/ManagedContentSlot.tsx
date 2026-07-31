import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { MODULE_META } from '../../data/mock-incidents';
import { resolveSlotContent } from '../../lib/content-slots';
import { getPlacementDefinition, getAspectRatioCss } from '../../lib/content-slots/registry';
import type { SlotKey, ResolvedContent, PlacementId } from '../../lib/content-slots';

// ---------------------------------------------------------------------------
// useResolvedContentSlot — shared hook so parents can know before rendering
// ---------------------------------------------------------------------------

export function useResolvedContentSlot(slotKey: SlotKey) {
  const globalDisplayEnabled = useAppStore((s) => s.sponsorsEnabled);
  const globalInfographicFallback = useAppStore((s) => s.globalInfographicFallback);
  const enabledInfographicTypes = useAppStore((s) => s.enabledInfographicTypes);
  const slotAssignments = useAppStore((s) => s.slotAssignments);
  const { campaigns } = useIncidentData();

  const assignment = slotAssignments[slotKey] ?? { slotKey, assetId: null, campaignId: null, mode: 'hidden' as const };

  return useMemo(() => resolveSlotContent({
    assignment: assignment as import('../../lib/content-slots').SlotAssignment,
    campaigns,
    globalInfographicFallback,
    globalDisplayEnabled,
    enabledInfographicTypes,
  }), [assignment, campaigns, globalInfographicFallback, globalDisplayEnabled, enabledInfographicTypes]);
}

// ---------------------------------------------------------------------------
// Mini infographic widgets
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#e53e3e', High: '#dd6b20', Medium: '#d69e2e', Low: '#38a169', Unknown: '#718096',
};

function MiniSeverityDonut({ incidents }: { incidents: any[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of incidents) { counts[i.severity] = (counts[i.severity] || 0) + 1; }
    return Object.entries(counts).map(([k, v]) => ({ label: k, value: v, color: SEVERITY_COLORS[k] || '#718096' }));
  }, [incidents]);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  let offset = 0;
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={52} height={52} viewBox="0 0 36 36">
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          const el = <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={d.color} strokeWidth="4" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-offset} transform="rotate(-90 18 18)" />;
          offset += pct;
          return el;
        })}
        <text x="18" y="18" textAnchor="middle" dy="0.35em" fill="#e2e8f0" fontSize="8" fontWeight="700">{total}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 3, letterSpacing: '0.05em' }}>SEVERITY</div>
        {data.slice(0, 4).map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: '#94a3b8', flex: 1 }}>{d.label}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#e2e8f0' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniModuleDonut({ incidents }: { incidents: any[] }) {
  const data = useMemo(() => {
    const counts: Record<string, { count: number; colour: string; label: string }> = {};
    for (const i of incidents) {
      const m = MODULE_META[i.module as keyof typeof MODULE_META];
      if (!m) continue;
      if (!counts[i.module]) counts[i.module] = { count: 0, colour: m.colour, label: m.label };
      counts[i.module]!.count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [incidents]);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  let offset = 0;
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={52} height={52} viewBox="0 0 36 36">
        {data.map((d, i) => {
          const pct = (d.count / total) * 100;
          const el = <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={d.colour} strokeWidth="4" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-offset} transform="rotate(-90 18 18)" />;
          offset += pct;
          return el;
        })}
        <text x="18" y="18" textAnchor="middle" dy="0.35em" fill="#e2e8f0" fontSize="8" fontWeight="700">{total}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 3, letterSpacing: '0.05em' }}>BY MODULE</div>
        {data.slice(0, 4).map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: d.colour, flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: '#94a3b8', flex: 1 }}>{d.label}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#e2e8f0' }}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniProvinceBar({ incidents }: { incidents: any[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of incidents) { if (i.province) counts[i.province] = (counts[i.province] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [incidents]);
  const max = data[0]?.[1] || 1;
  if (data.length === 0) return null;
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 5, letterSpacing: '0.05em' }}>BY PROVINCE</div>
      {data.map(([prov, count]) => (
        <div key={prov} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 8, color: '#94a3b8', width: 55, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flexShrink: 0 }}>{prov}</span>
          <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: '#4299e1', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 8, fontWeight: 600, color: '#e2e8f0', width: 18, textAlign: 'right' }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function MiniTrendLine({ incidents }: { incidents: any[] }) {
  const points = useMemo(() => {
    const now = Date.now();
    const days = 14;
    const buckets = new Array(days).fill(0);
    for (const inc of incidents) {
      const d = new Date(inc.reportedAt || inc.date).getTime();
      const age = Math.floor((now - d) / 86400000);
      if (age >= 0 && age < days) buckets[days - 1 - age]++;
    }
    return buckets;
  }, [incidents]);
  const max = Math.max(...points, 1);
  const w = 140, h = 40, px = w / (points.length - 1);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * px},${h - (v / max) * h}`).join(' ');
  const area = path + ` L${(points.length - 1) * px},${h} L0,${h} Z`;
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 4, letterSpacing: '0.05em' }}>14-DAY TREND</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <path d={area} fill="#4299e122" />
        <path d={path} fill="none" stroke="#4299e1" strokeWidth="1.5" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 7, color: '#64748b' }}>14d ago</span>
        <span style={{ fontSize: 7, color: '#64748b' }}>today</span>
      </div>
    </div>
  );
}

function MiniCasualties({ incidents }: { incidents: any[] }) {
  const stats = useMemo(() => {
    let deceased = 0, injured = 0;
    for (const i of incidents) { deceased += i.deceased || 0; injured += i.injured || 0; }
    return { deceased, injured, total: incidents.length };
  }, [incidents]);
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 6, letterSpacing: '0.05em' }}>CASUALTIES</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e53e3e' }}>{stats.deceased}</div>
          <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase' }}>deceased</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dd6b20' }}>{stats.injured}</div>
          <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase' }}>injured</div>
        </div>
      </div>
      <div style={{ fontSize: 8, color: '#64748b', marginTop: 4 }}>{stats.total} incidents tracked</div>
    </div>
  );
}

function MiniStats({ incidents }: { incidents: any[] }) {
  const stats = useMemo(() => {
    const critical = incidents.filter(i => i.severity === 'Critical').length;
    const verified = incidents.filter(i => i.verification?.startsWith('v4') || i.verification?.startsWith('v5')).length;
    const provinces = new Set(incidents.map(i => i.province)).size;
    return { total: incidents.length, critical, verified, provinces };
  }, [incidents]);
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 6, letterSpacing: '0.05em' }}>LIVE STATS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { label: 'Total', value: stats.total, color: '#e2e8f0' },
          { label: 'Critical', value: stats.critical, color: '#e53e3e' },
          { label: 'Verified', value: stats.verified, color: '#38a169' },
          { label: 'Provinces', value: stats.provinces, color: '#4299e1' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 7, color: '#64748b', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ads-OFF fallback infographics — 4 unique visuals, one per slot
// ---------------------------------------------------------------------------

const VERIFICATION_LEVELS = [
  { key: 'v0_unverified', label: 'Unverified', short: 'V0', color: '#e53e3e' },
  { key: 'v1_triage', label: 'Triage', short: 'V1', color: '#ed8936' },
  { key: 'v2_plausible_uncorroborated', label: 'Plausible', short: 'V2', color: '#d69e2e' },
  { key: 'v3_corroborated', label: 'Corroborated', short: 'V3', color: '#38a169' },
  { key: 'v4_primary_source_confirmed', label: 'Confirmed', short: 'V4', color: '#3182ce' },
  { key: 'v5_editorially_verified', label: 'Verified', short: 'V5', color: '#805ad5' },
];

function VerificationFunnel({ incidents }: { incidents: any[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of incidents) counts[i.verification] = (counts[i.verification] || 0) + 1;
    return VERIFICATION_LEVELS.map(l => ({ ...l, count: counts[l.key] || 0 }));
  }, [incidents]);
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '10px 12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 8, letterSpacing: '0.05em' }}>VERIFICATION PIPELINE</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4 }}>
        {data.map(d => {
          const pct = Math.max((d.count / max) * 100, 8);
          return (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 7, color: d.color, fontWeight: 700, width: 16, flexShrink: 0 }}>{d.short}</span>
              <div style={{ flex: 1, height: 14, background: '#1e293b', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `${d.color}40`, borderRadius: 3, borderRight: `2px solid ${d.color}` }} />
                <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 8, fontWeight: 600, color: '#e2e8f0' }}>{d.count}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 7, color: '#64748b', marginTop: 6, textAlign: 'center' }}>
        {incidents.length} total incidents
      </div>
    </div>
  );
}

function WeeklyTrend({ incidents }: { incidents: any[] }) {
  const { points, todayCount, weekTotal, direction } = useMemo(() => {
    const now = Date.now();
    const days = 7;
    const buckets = new Array(days).fill(0);
    const prevBuckets = new Array(days).fill(0);
    for (const inc of incidents) {
      const d = new Date(inc.dateReported || inc.reportedAt || inc.date).getTime();
      const age = Math.floor((now - d) / 86400000);
      if (age >= 0 && age < days) buckets[days - 1 - age]++;
      else if (age >= days && age < days * 2) prevBuckets[days - 1 - (age - days)]++;
    }
    const weekTotal = buckets.reduce((a, b) => a + b, 0);
    const prevTotal = prevBuckets.reduce((a, b) => a + b, 0);
    return { points: buckets, todayCount: buckets[days - 1] ?? 0, weekTotal, direction: weekTotal > prevTotal ? 'up' : weekTotal < prevTotal ? 'down' : 'flat' };
  }, [incidents]);
  const max = Math.max(...points, 1);
  const w = 160, h = 50;
  const px = w / (points.length - 1);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * px},${h - (v / max) * (h - 4)}`).join(' ');
  const area = path + ` L${(points.length - 1) * px},${h} L0,${h} Z`;
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIdx = new Date().getDay();
  const labels = Array.from({ length: 7 }, (_, i) => dayLabels[(todayIdx - 6 + i + 7) % 7]!);
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', letterSpacing: '0.05em' }}>7-DAY TREND</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{weekTotal}</span>
          <span style={{ fontSize: 12, color: direction === 'up' ? '#e53e3e' : direction === 'down' ? '#38a169' : '#64748b' }}>
            {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '●'}
          </span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3182ce" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3182ce" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-grad)" />
        <path d={path} fill="none" stroke="#3182ce" strokeWidth="2" strokeLinejoin="round" />
        {points.map((v, i) => (
          <circle key={i} cx={i * px} cy={h - (v / max) * (h - 4)} r={i === points.length - 1 ? 3 : 1.5} fill={i === points.length - 1 ? '#e2e8f0' : '#3182ce'} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        {labels.map((l, i) => (
          <span key={i} style={{ fontSize: 7, color: i === 6 ? '#e2e8f0' : '#64748b', fontWeight: i === 6 ? 700 : 400 }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function ImpactSummary({ incidents }: { incidents: any[] }) {
  const stats = useMemo(() => {
    let deceased = 0, injured = 0, critical = 0;
    for (const i of incidents) {
      deceased += i.casualties?.deceased || 0;
      injured += i.casualties?.injured || 0;
      if (i.severity === 'critical' || i.severity === 'Critical') critical++;
    }
    return { deceased, injured, critical, total: incidents.length };
  }, [incidents]);
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 8, letterSpacing: '0.05em' }}>IMPACT SUMMARY</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: '#1e293b', borderRadius: 6, padding: '8px 6px', textAlign: 'center', borderTop: '2px solid #e53e3e' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e53e3e' }}>{stats.deceased}</div>
          <div style={{ fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deceased</div>
        </div>
        <div style={{ flex: 1, background: '#1e293b', borderRadius: 6, padding: '8px 6px', textAlign: 'center', borderTop: '2px solid #ed8936' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ed8936' }}>{stats.injured}</div>
          <div style={{ fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Injured</div>
        </div>
        <div style={{ flex: 1, background: '#1e293b', borderRadius: 6, padding: '8px 6px', textAlign: 'center', borderTop: '2px solid #d69e2e' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#d69e2e' }}>{stats.critical}</div>
          <div style={{ fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Critical</div>
        </div>
      </div>
      <div style={{ fontSize: 8, color: '#64748b', marginTop: 6, textAlign: 'center' }}>
        Across {stats.total} tracked incidents
      </div>
    </div>
  );
}

function ActivityTimeline({ incidents }: { incidents: any[] }) {
  const recent = useMemo(() => {
    const sorted = [...incidents].sort((a, b) =>
      new Date(b.dateReported || b.reportedAt || b.date).getTime() -
      new Date(a.dateReported || a.reportedAt || a.date).getTime()
    );
    return sorted.slice(0, 8).map(inc => {
      const ago = Math.floor((Date.now() - new Date(inc.dateReported || inc.reportedAt || inc.date).getTime()) / 3600000);
      const timeStr = ago < 1 ? '<1h' : ago < 24 ? `${ago}h` : `${Math.floor(ago / 24)}d`;
      return { id: inc.id, title: inc.title, severity: inc.severity, module: inc.module, time: timeStr };
    });
  }, [incidents]);
  const sevColor: Record<string, string> = { critical: '#e53e3e', Critical: '#e53e3e', high: '#dd6b20', High: '#dd6b20', medium: '#d69e2e', Medium: '#d69e2e', low: '#38a169', Low: '#38a169' };
  const modLabel: Record<string, string> = { ait: 'Farm', unrest: 'Unrest', bias: 'Bias', infrastructure: 'Infra', natural: 'Natural', traffic: 'Traffic' };
  return (
    <div className="sponsor-slot" style={{ background: '#111827', border: '1px solid #c9a84c22', borderRadius: 8, padding: '10px 12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', marginBottom: 8, letterSpacing: '0.05em' }}>RECENT ACTIVITY</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
        {recent.map((inc, idx) => (
          <div key={inc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0', borderBottom: idx < recent.length - 1 ? '1px solid #1e293b' : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 10, paddingTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: sevColor[inc.severity] || '#718096' }} />
              {idx < recent.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 8, background: '#1e293b' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 8, color: '#e2e8f0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</div>
              <div style={{ fontSize: 7, color: '#64748b' }}>{modLabel[inc.module] || inc.module} · {inc.time} ago</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const INFOGRAPHIC_COMPONENTS: Record<string, React.FC<{ incidents: any[] }>> = {
  severity: MiniSeverityDonut,
  module: MiniModuleDonut,
  province: MiniProvinceBar,
  trend: MiniTrendLine,
  casualties: MiniCasualties,
  stats: MiniStats,
  verification_funnel: VerificationFunnel,
  weekly_trend: WeeklyTrend,
  impact_summary: ImpactSummary,
  activity_timeline: ActivityTimeline,
};

export const INFOGRAPHIC_LABELS: Record<string, string> = {
  severity: 'Severity breakdown',
  module: 'Module breakdown',
  province: 'Province bar chart',
  trend: '14-day trend line',
  casualties: 'Casualties summary',
  stats: 'Live statistics',
  verification_funnel: 'Verification pipeline',
  weekly_trend: '7-day trend',
  impact_summary: 'Impact summary',
  activity_timeline: 'Recent activity',
};

// ---------------------------------------------------------------------------
// Expand overlay — click any ad to see it large, centered over the map
// ---------------------------------------------------------------------------

function AdOverlay({ content, onClose }: { content: Extract<ResolvedContent, { type: 'sponsor' }>; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<Element | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    closeRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, [handleKeyDown]);

  return (
    <div className="ad-overlay-backdrop" onClick={onClose} role="presentation">
      <div ref={dialogRef} className="ad-overlay-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${content.displayName} — sponsored content`}>
        <button ref={closeRef} className="ad-overlay-close" onClick={onClose} aria-label="Close">&times;</button>
        {content.imageUrl ? (
          <div className="ad-overlay-image-wrap">
            <img src={content.imageUrl} alt={content.displayName} />
          </div>
        ) : (
          <div className="ad-overlay-text-wrap" style={{ background: content.bgColor, borderColor: content.accentColor }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: content.accentColor, marginBottom: 6 }}>{content.displayName}</div>
            <div style={{ fontSize: 13, color: content.textColor, marginBottom: 12 }}>{content.tagline}</div>
          </div>
        )}
        {content.linkUrl && (
          <a href={content.linkUrl} target="_blank" rel="noopener noreferrer" className="ad-overlay-cta">
            Visit Website &rarr;
          </a>
        )}
        <div className="ad-overlay-sponsor-tag">
          <span className="demo-tag">AD</span> {content.displayName}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SponsorFrame — placement-aware container with correct aspect ratio
// ---------------------------------------------------------------------------

function SponsorFrame({ slotKey, children }: { slotKey: PlacementId; children: React.ReactNode }) {
  return (
    <div
      className="sponsor-frame"
      data-slot={slotKey}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 0,
        background: 'var(--bg-elevated, #111827)',
        border: 'none',
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SponsorCreative — renders the image with correct fit mode
// ---------------------------------------------------------------------------

function SponsorCreative({ content, slotKey }: { content: Extract<ResolvedContent, { type: 'sponsor' }>; slotKey: PlacementId }) {
  const fit = content.fitMode === 'contain' ? 'contain' : 'cover';
  const pos = `${content.focalX}% ${content.focalY}%`;
  const bg = content.fitMode === 'contain' ? (content.backgroundColor || '#000') : undefined;
  const [imgError, setImgError] = useState<string | null>(null);

  if (imgError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#1a0000', color: '#e53e3e', padding: 8 }}
        data-image-error={imgError}>
        <div style={{ fontSize: 11, fontWeight: 700 }}>Image failed</div>
        <div style={{ fontSize: 9, color: '#a0aec0', textAlign: 'center', wordBreak: 'break-all' }}>{imgError}</div>
      </div>
    );
  }

  return (
    <img
      src={content.imageUrl}
      alt={content.displayName}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: fit,
        objectPosition: pos,
        backgroundColor: bg,
      }}
      loading="lazy"
      onError={() => setImgError(content.imageUrl ? `Failed to load: ${content.imageUrl.substring(0, 120)}` : 'No image URL provided')}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          setImgError(`Zero dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Ad rendering sub-components
// ---------------------------------------------------------------------------

function SponsorIcon({ icon, color, size = 28 }: { icon: string; color: string; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (icon) {
    case 'shield': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'web': return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" /></svg>;
    case 'farm': return <svg {...props}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" /><path d="M10 10h4" /></svg>;
    case 'lock': return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /><circle cx="12" cy="16" r="1" /></svg>;
    default: return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
  }
}

function ReservedState({ slotKey }: { slotKey: PlacementId }) {
  const def = getPlacementDefinition(slotKey);
  return (
    <SponsorFrame slotKey={slotKey}>
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 6,
        background: '#0d1117', color: '#4a5568',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
          Advertising Space
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          {def.publicLabel}
        </div>
        <div style={{ fontSize: 8, color: '#374151' }}>
          {def.referenceWidth}×{def.referenceHeight} creative required
        </div>
        <div style={{ fontSize: 8, color: '#374151', marginTop: 4 }}>
          Available for approved partners
        </div>
      </div>
    </SponsorFrame>
  );
}

function RenderPaidAd({ content, slotKey, onExpand }: { content: Extract<ResolvedContent, { type: 'sponsor' }>; slotKey: PlacementId; onExpand: () => void }) {
  const def = getPlacementDefinition(slotKey);

  if (content.imageUrl) {
    return (
      <SponsorFrame slotKey={slotKey}>
        <div style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }} title={`Click to expand: ${content.displayName}`} onClick={onExpand}>
          <SponsorCreative content={content} slotKey={slotKey} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600 }}>{content.displayName}</span>
            <span className="demo-tag" style={{ fontSize: 7 }}>AD</span>
          </div>
        </div>
      </SponsorFrame>
    );
  }

  if (!def.allowsTextCard) {
    return <ReservedState slotKey={slotKey} />;
  }

  if (content.size === 'premium') {
    return (
      <div className="sponsor-slot premium" style={{ background: content.bgColor, borderColor: content.accentColor, cursor: 'pointer' }} title={`Click to expand: ${content.displayName}`} onClick={onExpand}>
        <div className="sponsor-premium-header">
          <SponsorIcon icon={content.icon} color={content.accentColor} size={24} />
          <div className="sponsor-slot-name" style={{ color: content.accentColor }}>{content.displayName}</div>
        </div>
        <div className="sponsor-slot-tagline" style={{ color: content.textColor }}>{content.tagline}</div>
        <div className="sponsor-premium-footer">
          <div className="sponsor-premium-cta" style={{ borderColor: content.accentColor, color: content.accentColor }}>View Details →</div>
          <div className="sponsor-slot-badge"><span className="demo-tag">AD</span><span className="sponsor-label">Premium Sponsor</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="sponsor-slot" style={{ background: content.bgColor, borderColor: content.accentColor, cursor: 'pointer' }} title={`Click to expand: ${content.displayName}`} onClick={onExpand}>
      <div className="sponsor-slot-inner">
        <SponsorIcon icon={content.icon} color={content.accentColor} />
        <div className="sponsor-slot-text">
          <div className="sponsor-slot-name" style={{ color: content.accentColor }}>{content.displayName}</div>
          <div className="sponsor-slot-tagline" style={{ color: content.textColor }}>{content.tagline}</div>
        </div>
      </div>
      <div className="sponsor-slot-badge"><span className="demo-tag">AD</span><span className="sponsor-label">Sponsored</span></div>
    </div>
  );
}

function RenderInfographic({ infographicType }: { infographicType: string }) {
  const { incidents } = useIncidentData();
  const Component = INFOGRAPHIC_COMPONENTS[infographicType];
  if (!Component) return null;
  return <Component incidents={incidents} />;
}

function RenderPlaceholder({ src, alt, slotKey }: { src: string; alt: string; slotKey: PlacementId }) {
  const fit = 'contain';
  return (
    <SponsorFrame slotKey={slotKey}>
      <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} loading="lazy" />
    </SponsorFrame>
  );
}

// ---------------------------------------------------------------------------
// ManagedContentSlot — the single entry point for all 4 content placements
// ---------------------------------------------------------------------------

export function ManagedContentSlot({ slotKey, resolved: preResolved }: { slotKey: SlotKey; resolved?: ResolvedContent }) {
  const [expanded, setExpanded] = useState(false);
  const hookResolved = useResolvedContentSlot(slotKey);
  const resolved = preResolved ?? hookResolved;

  if (resolved.type === 'hidden') {
    return null;
  }

  const renderType = resolved.type;
  let inner: React.ReactNode = null;

  if (resolved.type === 'sponsor') {
    inner = (
      <>
        <RenderPaidAd content={resolved} slotKey={slotKey} onExpand={() => setExpanded(true)} />
        {expanded && <AdOverlay content={resolved} onClose={() => setExpanded(false)} />}
      </>
    );
  } else if (resolved.type === 'infographic') {
    inner = <RenderInfographic infographicType={resolved.infographicType} />;
  } else if (resolved.type === 'placeholder') {
    inner = <RenderPlaceholder src={resolved.src} alt={resolved.alt} slotKey={slotKey} />;
  }

  return (
    <div data-sponsor-slot={slotKey} data-render-type={renderType} data-visibility="visible" style={{ width: '100%', height: '100%' }}>
      {inner}
    </div>
  );
}
