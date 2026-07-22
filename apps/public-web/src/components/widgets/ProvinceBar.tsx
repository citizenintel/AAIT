import { useMemo } from 'react';
import { MOCK_INCIDENTS } from '../../data/mock-incidents';

export function ProvinceBar() {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inc of MOCK_INCIDENTS) {
      counts[inc.province] = (counts[inc.province] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, []);

  const max = Math.max(...data.map(d => d[1]), 1);

  return (
    <div className="widget-province">
      <div className="widget-province-title">By province</div>
      <div className="widget-province-bars">
        {data.map(([province, count]) => (
          <div key={province} className="widget-province-row">
            <span className="widget-province-label">{province}</span>
            <div className="widget-province-track">
              <div
                className="widget-province-fill"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="widget-province-value">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
