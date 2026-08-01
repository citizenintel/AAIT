import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { MODULE_META, SEVERITY_META, VERIFICATION_META } from '../../data/mock-incidents';
import { fetchIncidents, mockToRow } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';

type TimePeriod = 'all' | '7d' | '48h' | '24h' | '12h' | '6h' | '1h';

const TIME_PERIODS: { key: TimePeriod; label: string; hours: number }[] = [
  { key: 'all', label: 'All Time', hours: 0 },
  { key: '7d', label: '7 Days', hours: 168 },
  { key: '48h', label: '48 Hours', hours: 48 },
  { key: '24h', label: '24 Hours', hours: 24 },
  { key: '12h', label: '12 Hours', hours: 12 },
  { key: '6h', label: '6 Hours', hours: 6 },
  { key: '1h', label: '1 Hour', hours: 1 },
];

const CHART_TEXT = '#a1a1a6';
const CHART_BORDER = '#27272b';

function buildBaseOption() {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT },
  };
}

export function AdminDashboard() {
  const { user } = useAuth();
  const isModerator = user?.role === 'moderator';
  const [period, setPeriod] = useState<TimePeriod>('all');
  const { data: apiIncidents, loading } = useQuery(() => fetchIncidents(), []);
  const importedIncidents = useAppStore((s) => s.importedIncidents);

  const incidents = useMemo(() => {
    const api = apiIncidents ?? [];
    const imported = importedIncidents.map(mockToRow);
    return [...api, ...imported];
  }, [apiIncidents, importedIncidents]);

  const periodHours = TIME_PERIODS.find(p => p.key === period)!.hours;

  const filtered = useMemo(() => {
    if (periodHours === 0) return incidents;
    const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
    return incidents.filter(i => {
      if (!i.occurred_at) return false;
      return new Date(i.occurred_at).getTime() >= cutoff;
    });
  }, [incidents, periodHours]);

  const total = filtered.length;
  const critical = filtered.filter(i => i.severity === 'critical').length;
  const high = filtered.filter(i => i.severity === 'high').length;
  const verified = filtered.filter(i => i.verification_state?.startsWith('v5')).length;
  const deceased = filtered.reduce((sum, i) => sum + (i.fatality_count_confirmed ?? 0), 0);
  const injured = filtered.reduce((sum, i) => sum + (i.injury_count_confirmed ?? 0), 0);

  const severityData = Object.entries(SEVERITY_META).map(([key, meta]) => ({
    name: meta.label,
    value: filtered.filter(i => i.severity === key).length,
    itemStyle: { color: meta.colour },
  })).filter(d => d.value > 0);

  const moduleData = Object.entries(MODULE_META).map(([key, meta]) => ({
    name: meta.label,
    value: filtered.filter(i => i.category?.module === key).length,
    itemStyle: { color: meta.colour },
  })).filter(d => d.value > 0);

  const severityOption = {
    ...buildBaseOption(),
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: CHART_TEXT }, type: 'scroll' as const },
    series: [{
      type: 'pie' as const,
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      label: { show: false },
      data: severityData,
    }],
  };

  const moduleOption = {
    ...buildBaseOption(),
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: CHART_TEXT }, type: 'scroll' as const },
    series: [{
      type: 'pie' as const,
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      label: { show: false },
      data: moduleData,
    }],
  };

  const provinceMap = filtered.reduce<Record<string, number>>((acc, i) => {
    const prov = i.location?.province ?? 'Unknown';
    acc[prov] = (acc[prov] ?? 0) + 1;
    return acc;
  }, {});
  const provinceSorted = Object.entries(provinceMap).sort((a, b) => a[1] - b[1]);

  const provinceOption = {
    ...buildBaseOption(),
    tooltip: { trigger: 'axis' as const },
    grid: { left: 120, right: 40, top: 10, bottom: 30 },
    xAxis: { type: 'value' as const, splitLine: { lineStyle: { color: CHART_BORDER } }, axisLabel: { color: CHART_TEXT } },
    yAxis: { type: 'category' as const, data: provinceSorted.map(([p]) => p), axisLabel: { color: CHART_TEXT }, axisLine: { lineStyle: { color: CHART_BORDER } } },
    series: [{
      type: 'bar' as const,
      data: provinceSorted.map(([, c]) => c),
      itemStyle: { color: '#3182ce' },
      barMaxWidth: 24,
    }],
  };

  const hourBuckets = useMemo(() => {
    const bucketCount = Math.min(periodHours, 168);
    const bucketSizeMs = (periodHours * 60 * 60 * 1000) / bucketCount;
    const now = Date.now();
    const labels: string[] = [];
    const counts: number[] = new Array(bucketCount).fill(0);

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = now - (bucketCount - i) * bucketSizeMs;
      const d = new Date(bucketStart);
      if (periodHours <= 24) {
        labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        labels.push(d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
      }
    }

    for (const inc of filtered) {
      if (!inc.occurred_at) continue;
      const t = new Date(inc.occurred_at).getTime();
      const idx = Math.floor((t - (now - periodHours * 60 * 60 * 1000)) / bucketSizeMs);
      if (idx >= 0 && idx < bucketCount) counts[idx] = (counts[idx] ?? 0) + 1;
    }

    return { labels, counts };
  }, [filtered, periodHours]);

  const trendOption = {
    ...buildBaseOption(),
    tooltip: { trigger: 'axis' as const },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category' as const,
      data: hourBuckets.labels,
      axisLabel: { color: CHART_TEXT, rotate: 30, fontSize: 10 },
      axisLine: { lineStyle: { color: CHART_BORDER } },
    },
    yAxis: {
      type: 'value' as const,
      minInterval: 1,
      splitLine: { lineStyle: { color: CHART_BORDER } },
      axisLabel: { color: CHART_TEXT },
    },
    series: [{
      type: 'line' as const,
      data: hourBuckets.counts,
      smooth: true,
      areaStyle: { opacity: 0.15 },
      lineStyle: { width: 2 },
      itemStyle: { color: '#38b2ac' },
    }],
  };

  const verificationMap = filtered.reduce<Record<string, number>>((acc, i) => {
    const state = i.verification_state ?? 'v0_unverified';
    acc[state] = (acc[state] ?? 0) + 1;
    return acc;
  }, {});
  const verificationData = Object.entries(verificationMap).map(([key, count]) => {
    const meta = VERIFICATION_META[key];
    return {
      name: meta?.label ?? key.replace(/_/g, ' '),
      value: count,
    };
  }).filter(d => d.value > 0);

  const verificationColors = ['#718096', '#a0aec0', '#ecc94b', '#4299e1', '#48bb78', '#38b2ac'];
  const verificationOption = {
    ...buildBaseOption(),
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: CHART_TEXT }, type: 'scroll' as const },
    color: verificationColors,
    series: [{
      type: 'pie' as const,
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      label: { show: false },
      data: verificationData,
    }],
  };

  const casualtyByModule = Object.entries(MODULE_META).map(([key, meta]) => {
    const moduleIncidents = filtered.filter(i => i.category?.module === key);
    return {
      module: meta.label,
      deceased: moduleIncidents.reduce((s, i) => s + (i.fatality_count_confirmed ?? 0), 0),
      injured: moduleIncidents.reduce((s, i) => s + (i.injury_count_confirmed ?? 0), 0),
    };
  }).filter(d => d.deceased > 0 || d.injured > 0);

  const casualtyOption = {
    ...buildBaseOption(),
    tooltip: { trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { color: CHART_TEXT }, data: ['Deceased', 'Injured'] },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category' as const,
      data: casualtyByModule.map(d => d.module),
      axisLabel: { color: CHART_TEXT, rotate: 15 },
      axisLine: { lineStyle: { color: CHART_BORDER } },
    },
    yAxis: {
      type: 'value' as const,
      minInterval: 1,
      splitLine: { lineStyle: { color: CHART_BORDER } },
      axisLabel: { color: CHART_TEXT },
    },
    series: [
      {
        name: 'Deceased',
        type: 'bar' as const,
        stack: 'casualties',
        data: casualtyByModule.map(d => d.deceased),
        itemStyle: { color: '#c53030' },
        barMaxWidth: 32,
      },
      {
        name: 'Injured',
        type: 'bar' as const,
        stack: 'casualties',
        data: casualtyByModule.map(d => d.injured),
        itemStyle: { color: '#ed8936' },
        barMaxWidth: 32,
      },
    ],
  };

  const recent = filtered.slice(0, 10);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Incident overview {isModerator ? '(moderator view)' : ''}</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {TIME_PERIODS.map(tp => (
          <button
            key={tp.key}
            className={`btn btn-small ${period === tp.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriod(tp.key)}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>Loading dashboard data...</p>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card critical">
          <div className="stat-value">{critical}</div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#dd6b20' }}>{high}</div>
          <div className="stat-label">High</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#38b2ac' }}>{verified}</div>
          <div className="stat-label">Verified</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#c53030' }}>{deceased}</div>
          <div className="stat-label">Deceased</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#ed8936' }}>{injured}</div>
          <div className="stat-label">Injured</div>
        </div>
      </div>

      <div className="admin-grid-2col">
        <div className="admin-card">
          <h2>Severity Breakdown</h2>
          <div style={{ width: '100%', height: 320 }}>
            <ReactECharts option={severityOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        <div className="admin-card">
          <h2>Module Distribution</h2>
          <div style={{ width: '100%', height: 320 }}>
            <ReactECharts option={moduleOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {!isModerator && (
          <>
            <div className="admin-card">
              <h2>Incidents by Province</h2>
              <div style={{ width: '100%', height: 320 }}>
                <ReactECharts option={provinceOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            <div className="admin-card">
              <h2>Incident Trend</h2>
              <div style={{ width: '100%', height: 320 }}>
                <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            <div className="admin-card">
              <h2>Verification Status</h2>
              <div style={{ width: '100%', height: 320 }}>
                <ReactECharts option={verificationOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            <div className="admin-card">
              <h2>Casualties by Module</h2>
              <div style={{ width: '100%', height: 320 }}>
                <ReactECharts option={casualtyOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>
          </>
        )}
      </div>

      {!isModerator && (
        <div className="admin-card">
          <h2>Recent Incidents</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Module</th>
                <th>Severity</th>
                <th>Verification</th>
                <th>Province</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(inc => {
                const mod = MODULE_META[inc.category?.module as keyof typeof MODULE_META];
                const sev = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META];
                return (
                  <tr key={inc.id}>
                    <td className="td-title">{inc.title}</td>
                    <td><span style={{ color: mod?.colour }}>{mod?.label}</span></td>
                    <td><span className="table-badge" style={{ color: sev?.colour }}>{inc.severity}</span></td>
                    <td>{inc.verification_state?.replace(/_/g, ' ').replace(/^v\d\s*/, '') ?? ''}</td>
                    <td>{inc.location?.province}</td>
                    <td>{inc.occurred_at}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
