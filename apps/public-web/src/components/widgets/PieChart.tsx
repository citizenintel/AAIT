interface Slice {
  label: string;
  value: number;
  colour: string;
}

interface PieChartProps {
  slices: Slice[];
  title: string;
  size?: number;
}

export function PieChart({ slices, title, size = 120 }: PieChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;

  const paths = slices.filter(s => s.value > 0).map((slice) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += slice.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = slice.value / total > 0.5 ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    if (slices.filter(s => s.value > 0).length === 1) {
      return (
        <circle key={slice.label} cx={cx} cy={cy} r={r} fill={slice.colour} opacity="0.85" />
      );
    }

    return (
      <path
        key={slice.label}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={slice.colour}
        opacity="0.85"
        stroke="var(--bg-surface)"
        strokeWidth="1.5"
      />
    );
  });

  return (
    <div className="widget-pie">
      <div className="widget-pie-title">{title}</div>
      <div className="widget-pie-chart">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths}
          <circle cx={cx} cy={cy} r={r * 0.52} fill="var(--bg-surface)" />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="700">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="9">total</text>
        </svg>
      </div>
      <div className="widget-pie-legend">
        {slices.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="widget-pie-legend-item">
            <span className="widget-pie-legend-dot" style={{ background: s.colour }} />
            <span className="widget-pie-legend-label">{s.label}</span>
            <span className="widget-pie-legend-value">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
