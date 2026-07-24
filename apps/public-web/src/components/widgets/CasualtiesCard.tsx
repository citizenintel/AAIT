import { useMemo } from 'react';
import { MODULE_META } from '../../data/mock-incidents';
import { useIncidentData } from '../../lib/hooks/useIncidentData';

export function CasualtiesCard() {
  const { incidents } = useIncidentData();
  const data = useMemo(() => {
    let totalDeceased = 0;
    let totalInjured = 0;
    const byModule: Record<string, { deceased: number; injured: number }> = {};

    for (const inc of incidents) {
      const d = inc.casualties?.deceased ?? 0;
      const inj = inc.casualties?.injured ?? 0;
      totalDeceased += d;
      totalInjured += inj;
      if (d > 0 || inj > 0) {
        if (!byModule[inc.module]) byModule[inc.module] = { deceased: 0, injured: 0 };
        byModule[inc.module]!.deceased += d;
        byModule[inc.module]!.injured += inj;
      }
    }

    return { totalDeceased, totalInjured, byModule };
  }, [incidents]);

  return (
    <div className="widget-casualties">
      <div className="widget-casualties-title">Casualties</div>
      <div className="widget-casualties-totals">
        <div className="widget-casualty-total deceased">
          <span className="widget-casualty-num">{data.totalDeceased}</span>
          <span className="widget-casualty-label">Deceased</span>
        </div>
        <div className="widget-casualty-total injured">
          <span className="widget-casualty-num">{data.totalInjured}</span>
          <span className="widget-casualty-label">Injured</span>
        </div>
      </div>
      <div className="widget-casualties-breakdown">
        {Object.entries(data.byModule).map(([mod, counts]) => {
          const meta = MODULE_META[mod as keyof typeof MODULE_META];
          return (
            <div key={mod} className="widget-casualty-row">
              <span className="widget-casualty-mod" style={{ color: meta?.colour }}>{meta?.label}</span>
              <span className="widget-casualty-counts">
                {counts.deceased > 0 && <span className="deceased">{counts.deceased}d</span>}
                {counts.injured > 0 && <span className="injured">{counts.injured}i</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
