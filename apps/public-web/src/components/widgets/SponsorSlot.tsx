import { useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { MODULE_META } from '../../data/mock-incidents';
import { type SponsorAd } from '../../data/mock-sponsors';
import { getActiveImages } from '../../lib/services/hero-images';

function SponsorIcon({ icon, color, size = 28 }: { icon: SponsorAd['icon']; color: string; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (icon) {
    case 'shield': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'web': return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" /></svg>;
    case 'farm': return <svg {...props}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" /><path d="M10 10h4" /></svg>;
    case 'lock': return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /><circle cx="12" cy="16" r="1" /></svg>;
  }
}

// ---------------------------------------------------------------------------
// Mini infographic widgets for sponsor slots
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

const INFOGRAPHIC_COMPONENTS: Record<string, React.FC<{ incidents: any[] }>> = {
  severity: MiniSeverityDonut,
  module: MiniModuleDonut,
  province: MiniProvinceBar,
  trend: MiniTrendLine,
  casualties: MiniCasualties,
  stats: MiniStats,
};

export const INFOGRAPHIC_LABELS: Record<string, string> = {
  severity: 'Severity breakdown',
  module: 'Module breakdown',
  province: 'Province bar chart',
  trend: '14-day trend line',
  casualties: 'Casualties summary',
  stats: 'Live statistics',
};

function SlotInfographic({ slot }: { slot: number }) {
  const { incidents } = useIncidentData();
  const types = useAppStore((s) => s.enabledInfographicTypes);
  if (types.length === 0) return null;
  const type = types[(slot - 1) % types.length]!;
  const Component = INFOGRAPHIC_COMPONENTS[type];
  if (!Component) return null;
  return <Component incidents={incidents} />;
}

// ---------------------------------------------------------------------------
// Placeholder image slot
// ---------------------------------------------------------------------------

function SlotImage({ slot, category }: { slot: number; category: 'hero' | 'ad' }) {
  const images = useMemo(() => getActiveImages(category), [category]);
  if (images.length === 0) return null;
  const img = images[(slot - 1) % images.length]!;

  return (
    <div
      className="sponsor-slot hero-image-slot"
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid #c9a84c33',
      }}
    >
      <img
        src={img.src}
        alt={img.alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          minHeight: 120,
        }}
        loading="lazy"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promo card fallback (last resort)
// ---------------------------------------------------------------------------

interface PromoCard {
  icon: string;
  accent: string;
  badge: string;
  title: string;
  body: string;
  footnote?: string;
  cta?: string;
}

function PromoIcon({ type, color, size = 22 }: { type: string; color: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'radar':
      return <svg {...p}><circle cx="12" cy="12" r="10" opacity="0.3" /><circle cx="12" cy="12" r="6" opacity="0.5" /><circle cx="12" cy="12" r="2" fill={color} stroke="none" /><line x1="12" y1="2" x2="12" y2="12" strokeWidth="2" /></svg>;
    case 'shield-check':
      return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" strokeWidth="2" /></svg>;
    case 'heart':
      return <svg {...p}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill={color} opacity="0.2" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

const PROMO_CARDS: PromoCard[] = [
  {
    icon: 'radar', accent: '#c9a84c', badge: 'INTELLIGENCE',
    title: 'AAIT Incident Tracker',
    body: 'Real-time incident tracking across South Africa. Verified, cross-referenced, bias-assessed.',
    footnote: 'Independent. Data-driven. No agenda.',
  },
  {
    icon: 'shield-check', accent: '#38a169', badge: 'VERIFIED',
    title: 'Every Claim Checked',
    body: 'Five-level verification pipeline. Multiple independent sources. No single-source claims published as fact.',
  },
  {
    icon: 'heart', accent: '#c9a84c', badge: 'SPONSOR',
    title: 'Advertise Here',
    body: 'Want this spot? Contact Webadmin to rent it as a sponsor.',
    cta: 'Become a sponsor →',
  },
];

function SlotPromoCard({ slot }: { slot: number }) {
  const card = PROMO_CARDS[(slot - 1) % PROMO_CARDS.length]!;
  const bg = '#111827';
  const borderColor = card.accent + '44';

  return (
    <div
      className="sponsor-slot promo-card"
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, ${card.accent}11 100%)`,
        border: `1px solid ${borderColor}`,
        borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.45,
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 60, height: 60, background: `radial-gradient(circle, ${card.accent}18 0%, transparent 70%)`, borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <PromoIcon type={card.icon} color={card.accent} size={20} />
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: card.accent, textTransform: 'uppercase' as const, background: card.accent + '15', padding: '2px 6px', borderRadius: 3 }}>{card.badge}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, lineHeight: 1.2 }}>{card.title}</div>
      <div style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.5, marginBottom: 4 }}>{card.body}</div>
      {card.cta && <div style={{ fontSize: 9, fontWeight: 600, color: card.accent, marginTop: 2, letterSpacing: '0.02em' }}>{card.cta}</div>}
      {card.footnote && <div style={{ fontSize: 8.5, color: '#64748b', fontStyle: 'italic', marginTop: 3 }}>{card.footnote}</div>}
      <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 7, fontWeight: 700, letterSpacing: '0.12em', color: card.accent + '55' }}>AAIT</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SponsorSlot — the single entry point for all 6 ad placements
// ---------------------------------------------------------------------------
// Priority chain:
//   1. Active paid campaign (with full-bleed image if imageUrl assigned)
//   2. Placeholder images (if toggle ON + images uploaded)
//   3. Infographics (if toggle ON + types selected)
//   4. Promo card (last resort)
// ---------------------------------------------------------------------------

export function SponsorSlot({ slot }: { slot: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);
  const placeholderEnabled = useAppStore((s) => s.placeholderEnabled);
  const infographicsEnabled = useAppStore((s) => s.infographicsEnabled);
  const { campaigns } = useIncidentData();
  const campaign = sponsorsEnabled
    ? campaigns.find((c) => c.placement === `slot-${slot}` && c.status === 'active')
    : undefined;

  // --- Paid ad ---
  if (campaign) {
    const ad = {
      name: campaign.display_name,
      tagline: campaign.tagline ?? '',
      description: undefined as string | undefined,
      websiteUrl: campaign.link_url ?? '',
      imageUrl: campaign.image_url ?? '',
      size: campaign.size as SponsorAd['size'],
      bgColor: '#1a2332',
      textColor: '#e2e8f0',
      accentColor: '#c9a84c',
      icon: 'shield' as SponsorAd['icon'],
    };

    const handleClick = () => {
      if (ad.websiteUrl) window.open(ad.websiteUrl, '_blank', 'noopener,noreferrer');
    };

    if (ad.imageUrl) {
      return (
        <div className="sponsor-slot" style={{ borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid #c9a84c33', cursor: ad.websiteUrl ? 'pointer' : 'default' }} title={`Sponsor: ${ad.name}`} onClick={handleClick}>
          <img src={ad.imageUrl} alt={ad.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 120 }} loading="lazy" />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600 }}>{ad.name}</span>
            <span className="demo-tag" style={{ fontSize: 7 }}>AD</span>
          </div>
        </div>
      );
    }

    if (ad.size === 'banner') {
      return (
        <div className="sponsor-slot banner" style={{ background: ad.bgColor, borderColor: ad.accentColor, cursor: ad.websiteUrl ? 'pointer' : 'default' }} title={`Sponsor: ${ad.name}`} onClick={handleClick}>
          <SponsorIcon icon={ad.icon} color={ad.accentColor} size={20} />
          <div className="sponsor-banner-text">
            <span className="sponsor-slot-name" style={{ color: ad.accentColor }}>{ad.name}</span>
            <span className="sponsor-slot-tagline" style={{ color: ad.textColor }}>{ad.tagline}</span>
          </div>
          <div className="sponsor-slot-badge"><span className="demo-tag">AD</span></div>
        </div>
      );
    }

    if (ad.size === 'premium') {
      return (
        <div className="sponsor-slot premium" style={{ background: ad.bgColor, borderColor: ad.accentColor, cursor: ad.websiteUrl ? 'pointer' : 'default' }} title={`Sponsor: ${ad.name}`} onClick={handleClick}>
          <div className="sponsor-premium-header">
            <SponsorIcon icon={ad.icon} color={ad.accentColor} size={24} />
            <div className="sponsor-slot-name" style={{ color: ad.accentColor }}>{ad.name}</div>
          </div>
          <div className="sponsor-slot-tagline" style={{ color: ad.textColor }}>{ad.tagline}</div>
          {ad.description && <div className="sponsor-premium-desc" style={{ color: ad.textColor }}>{ad.description}</div>}
          <div className="sponsor-premium-footer">
            <div className="sponsor-premium-cta" style={{ borderColor: ad.accentColor, color: ad.accentColor }}>Visit Website →</div>
            <div className="sponsor-slot-badge"><span className="demo-tag">AD</span><span className="sponsor-label">Premium Sponsor</span></div>
          </div>
        </div>
      );
    }

    return (
      <div className="sponsor-slot" style={{ background: ad.bgColor, borderColor: ad.accentColor, cursor: ad.websiteUrl ? 'pointer' : 'default' }} title={`Sponsor: ${ad.name}`} onClick={handleClick}>
        <div className="sponsor-slot-inner">
          <SponsorIcon icon={ad.icon} color={ad.accentColor} />
          <div className="sponsor-slot-text">
            <div className="sponsor-slot-name" style={{ color: ad.accentColor }}>{ad.name}</div>
            <div className="sponsor-slot-tagline" style={{ color: ad.textColor }}>{ad.tagline}</div>
          </div>
        </div>
        <div className="sponsor-slot-badge"><span className="demo-tag">AD</span><span className="sponsor-label">Sponsored</span></div>
      </div>
    );
  }

  // --- Placeholder images (uploaded by admin) ---
  if (placeholderEnabled) {
    const placeholderImages = getActiveImages('hero');
    if (placeholderImages.length > 0) {
      return <SlotImage slot={slot} category="hero" />;
    }
  }

  // --- Infographics (data viz mini-widgets) ---
  if (infographicsEnabled) {
    return <SlotInfographic slot={slot} />;
  }

  // --- Last resort: promo card ---
  return <SlotPromoCard slot={slot} />;
}
