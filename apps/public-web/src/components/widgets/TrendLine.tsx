import { useMemo } from 'react';
import { MOCK_INCIDENTS } from '../../data/mock-incidents';

export function TrendLine() {
  const data = useMemo(() => {
    const days: Record<string, number> = {};
    const today = new Date('2026-07-20');
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    for (const inc of MOCK_INCIDENTS) {
      const current = days[inc.dateOccurred];
      if (current !== undefined) {
        days[inc.dateOccurred] = current + 1;
      }
    }
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, []);

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const w = 260;
  const h = 80;
  const padX = 4;
  const padY = 8;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * plotW;
    const y = padY + plotH - (d.count / maxCount) * plotH;
    return `${x},${y}`;
  });

  const areaPoints = `${padX},${padY + plotH} ${points.join(' ')} ${padX + plotW},${padY + plotH}`;

  return (
    <div className="widget-trend">
      <div className="widget-trend-title">14-day trend</div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polygon points={areaPoints} fill="var(--accent)" opacity="0.12" />
        <polyline points={points.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          if (d.count === 0) return null;
          const x = padX + (i / (data.length - 1)) * plotW;
          const y = padY + plotH - (d.count / maxCount) * plotH;
          return <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" />;
        })}
      </svg>
      <div className="widget-trend-labels">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
