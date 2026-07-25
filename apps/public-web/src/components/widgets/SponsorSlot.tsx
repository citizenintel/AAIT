import { useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { MODULE_META, SEVERITY_META } from '../../data/mock-incidents';
import { type SponsorAd } from '../../data/mock-sponsors';

function SponsorIcon({ icon, color, size = 28 }: { icon: SponsorAd['icon']; color: string; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (icon) {
    case 'shield': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'web': return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" /></svg>;
    case 'farm': return <svg {...props}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" /><path d="M10 10h4" /></svg>;
    case 'lock': return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /><circle cx="12" cy="16" r="1" /></svg>;
  }
}

const INFOGRAPHIC_VARIANTS: readonly { type: 'severity' | 'module' | 'topProvince' | 'casualties' | 'recentCount' | 'verifiedPct' }[] = [
  { type: 'severity' },
  { type: 'module' },
  { type: 'topProvince' },
  { type: 'casualties' },
  { type: 'recentCount' },
  { type: 'verifiedPct' },
];

function SlotInfoGraphic({ slot }: { slot: number }) {
  const { incidents } = useIncidentData();
  const variant = INFOGRAPHIC_VARIANTS[(slot - 1) % INFOGRAPHIC_VARIANTS.length]!;

  const data = useMemo(() => {
    const now = Date.now();
    const recent = incidents.filter(i => now - new Date(i.dateOccurred).getTime() < 86400000);

    const moduleCounts = Object.entries(MODULE_META).map(([key, meta]) => ({
      label: meta.label, count: incidents.filter(i => i.module === key).length, colour: meta.colour,
    })).sort((a, b) => b.count - a.count);

    const provinceCounts: Record<string, number> = {};
    for (const inc of incidents) {
      provinceCounts[inc.province] = (provinceCounts[inc.province] ?? 0) + 1;
    }
    const topProvince = Object.entries(provinceCounts).sort(([, a], [, b]) => b - a)[0];

    const deceased = incidents.reduce((s, i) => s + (i.casualties?.deceased ?? 0), 0);
    const injured = incidents.reduce((s, i) => s + (i.casualties?.injured ?? 0), 0);

    const verified = incidents.filter(i => i.verification.startsWith('v4') || i.verification.startsWith('v5')).length;
    const verifiedPct = incidents.length > 0 ? Math.round((verified / incidents.length) * 100) : 0;

    return {
      recent,
      criticalCount: incidents.filter(i => i.severity === 'critical').length,
      highCount: incidents.filter(i => i.severity === 'high').length,
      moduleCounts,
      topProvince,
      deceased,
      injured,
      verifiedPct,
      total: incidents.length,
    };
  }, [incidents]);

  const box: React.CSSProperties = {
    background: 'var(--surface-1, var(--surface))',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 12,
    lineHeight: 1.4,
  };
  const labelStyle: React.CSSProperties = { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 };
  const bigStat: React.CSSProperties = { fontSize: 22, fontWeight: 700, lineHeight: 1.1 };
  const sub: React.CSSProperties = { fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 };

  switch (variant.type) {
    case 'severity':
      return (
        <div className="sponsor-slot infographic" style={box}>
          <div style={labelStyle}>Severity Snapshot</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: SEVERITY_META.critical.colour }}>{data.criticalCount} critical</span>
            <span style={{ fontWeight: 700, color: SEVERITY_META.high.colour }}>{data.highCount} high</span>
          </div>
          <div style={sub}>{data.total} total incidents tracked</div>
        </div>
      );
    case 'module': {
      const top3 = data.moduleCounts.slice(0, 3);
      return (
        <div className="sponsor-slot infographic" style={box}>
          <div style={labelStyle}>Top Modules</div>
          {top3.map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{ fontSize: 10, width: 70, flexShrink: 0, color: 'var(--text-secondary)' }}>{m.label}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, data.total > 0 ? (m.count / data.total) * 100 : 0)}%`, height: '100%', background: m.colour, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, width: 20, textAlign: 'right' }}>{m.count}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'topProvince':
      return (
        <div className="sponsor-slot infographic" style={box}>
          <div style={labelStyle}>Most Active Province</div>
          <div style={bigStat}>{data.topProvince?.[0] ?? '—'}</div>
          <div style={sub}>{data.topProvince?.[1] ?? 0} incidents</div>
        </div>
      );
    case 'casualties':
      return (
        <div className="sponsor-slot infographic" style={box}>
          <div style={labelStyle}>Casualties</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: '#c53030' }}>{data.deceased} deceased</span>
            <span style={{ fontWeight: 700, color: '#ed8936' }}>{data.injured} injured</span>
          </div>
          <div style={sub}>All tracked incidents</div>
        </div>
      );
    case 'recentCount':
      return (
        <div className="sponsor-slot infographic" style={box}>
          <div style={labelStyle}>Last 24 Hours</div>
          <div style={bigStat}>{data.recent.length}</div>
          <div style={sub}>incidents reported</div>
        </div>
      );
    case 'verifiedPct':
      return (
        <div className="sponsor-slot infographic" style={box}>
          <div style={labelStyle}>Verification Rate</div>
          <div style={bigStat}>{data.verifiedPct}%</div>
          <div style={sub}>of incidents fully verified</div>
        </div>
      );
  }
}

export function SponsorSlot({ slot }: { slot: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);
  const { campaigns } = useIncidentData();
  const campaign = campaigns.find((c) => c.placement === `slot-${slot}` && c.status === 'active');

  if (!sponsorsEnabled || !campaign) {
    return <SlotInfoGraphic slot={slot} />;
  }

  const ad = {
    name: campaign.display_name,
    tagline: campaign.tagline ?? '',
    description: undefined as string | undefined,
    websiteUrl: campaign.link_url ?? '',
    size: campaign.size as SponsorAd['size'],
    bgColor: '#1a2332',
    textColor: '#e2e8f0',
    accentColor: '#c9a84c',
    icon: 'shield' as SponsorAd['icon'],
  };

  if (ad.size === 'banner') {
    return (
      <div
        className="sponsor-slot banner"
        style={{ background: ad.bgColor, borderColor: ad.accentColor }}
        title={`Sponsor: ${ad.name} — ${ad.websiteUrl}`}
      >
        <SponsorIcon icon={ad.icon} color={ad.accentColor} size={20} />
        <div className="sponsor-banner-text">
          <span className="sponsor-slot-name" style={{ color: ad.accentColor }}>{ad.name}</span>
          <span className="sponsor-slot-tagline" style={{ color: ad.textColor }}>{ad.tagline}</span>
        </div>
        <div className="sponsor-slot-badge">
          <span className="demo-tag">DEMO</span>
        </div>
      </div>
    );
  }

  if (ad.size === 'premium') {
    return (
      <div
        className="sponsor-slot premium"
        style={{ background: ad.bgColor, borderColor: ad.accentColor }}
        title={`Sponsor: ${ad.name} — ${ad.websiteUrl}`}
      >
        <div className="sponsor-premium-header">
          <SponsorIcon icon={ad.icon} color={ad.accentColor} size={24} />
          <div className="sponsor-slot-name" style={{ color: ad.accentColor }}>{ad.name}</div>
        </div>
        <div className="sponsor-slot-tagline" style={{ color: ad.textColor }}>{ad.tagline}</div>
        {ad.description && (
          <div className="sponsor-premium-desc" style={{ color: ad.textColor }}>{ad.description}</div>
        )}
        <div className="sponsor-premium-footer">
          <div className="sponsor-premium-cta" style={{ borderColor: ad.accentColor, color: ad.accentColor }}>
            Visit Website →
          </div>
          <div className="sponsor-slot-badge">
            <span className="demo-tag">DEMO</span>
            <span className="sponsor-label">Premium Sponsor</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sponsor-slot"
      style={{ background: ad.bgColor, borderColor: ad.accentColor }}
      title={`Sponsor: ${ad.name} — ${ad.websiteUrl}`}
    >
      <div className="sponsor-slot-inner">
        <SponsorIcon icon={ad.icon} color={ad.accentColor} />
        <div className="sponsor-slot-text">
          <div className="sponsor-slot-name" style={{ color: ad.accentColor }}>{ad.name}</div>
          <div className="sponsor-slot-tagline" style={{ color: ad.textColor }}>{ad.tagline}</div>
        </div>
      </div>
      <div className="sponsor-slot-badge">
        <span className="demo-tag">DEMO</span>
        <span className="sponsor-label">Sponsored</span>
      </div>
    </div>
  );
}
