import { useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
import { MODULE_META } from '../../data/mock-incidents';
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

// ---------------------------------------------------------------------------
// SVG icons for internal promo cards
// ---------------------------------------------------------------------------

function PromoIcon({ type, color, size = 22 }: { type: string; color: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'radar':
      return <svg {...p}><circle cx="12" cy="12" r="10" opacity="0.3" /><circle cx="12" cy="12" r="6" opacity="0.5" /><circle cx="12" cy="12" r="2" fill={color} stroke="none" /><line x1="12" y1="2" x2="12" y2="12" strokeWidth="2" /></svg>;
    case 'shield-check':
      return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" strokeWidth="2" /></svg>;
    case 'megaphone':
      return <svg {...p}><path d="M3 11l18-5v14L3 15v-4z" /><path d="M11.6 16.8a3 3 0 01-5.2-1.8" /><line x1="21" y1="6" x2="21" y2="20" /></svg>;
    case 'chart':
      return <svg {...p}><rect x="3" y="12" width="4" height="9" rx="1" fill={color} opacity="0.3" /><rect x="10" y="8" width="4" height="13" rx="1" fill={color} opacity="0.5" /><rect x="17" y="4" width="4" height="17" rx="1" fill={color} opacity="0.7" /></svg>;
    case 'heart':
      return <svg {...p}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill={color} opacity="0.2" /></svg>;
    case 'map-pin':
      return <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" fill={color} opacity="0.3" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

// ---------------------------------------------------------------------------
// Internal promo card content
// ---------------------------------------------------------------------------

interface PromoCard {
  icon: string;
  accent: string;
  badge: string;
  title: string;
  body: string;
  footnote?: string;
  cta?: string;
  liveData?: boolean;
}

const PROMO_CARDS: PromoCard[] = [
  {
    icon: 'radar',
    accent: '#c9a84c',
    badge: 'INTELLIGENCE',
    title: 'Intelligence Twin',
    body: 'Real-time incident tracking across South Africa. Verified, cross-referenced, bias-assessed. Not what you think happened — what actually did.',
    footnote: 'Independent. Data-driven. No agenda.',
  },
  {
    icon: 'shield-check',
    accent: '#38a169',
    badge: 'VERIFIED',
    title: 'Every Claim Checked',
    body: 'Five-level verification pipeline. Multiple independent sources. No single-source claims published as fact.',
    liveData: true,
  },
  {
    icon: 'megaphone',
    accent: '#4299e1',
    badge: 'REPORT',
    title: 'See Something? Report It',
    body: 'Citizen reports are the backbone of ground truth. Your eyes matter more than any news feed. Secure, anonymous submission.',
    cta: 'Submit a report →',
  },
  {
    icon: 'chart',
    accent: '#9f7aea',
    badge: 'SUBSCRIBE',
    title: 'Go Deeper',
    body: 'Premium analytics, trend breakdowns, and AI-powered pattern detection. Research-grade data for those who need more than headlines.',
    cta: 'View plans →',
  },
  {
    icon: 'map-pin',
    accent: '#ed8936',
    badge: 'LIVE DATA',
    title: 'Across All 9 Provinces',
    body: 'Farm attacks, service delivery, infrastructure, unrest, crime — tracked by module, mapped by location, measured by change from baseline.',
    liveData: true,
  },
  {
    icon: 'heart',
    accent: '#c9a84c',
    badge: 'SPONSOR',
    title: 'Advertise Here',
    body: 'Want this spot? Contact Webadmin to rent it as a sponsor. Every bit helps — this is hard work, and unfortunately we can\'t do it for free, even though we\'d love to.',
    footnote: 'Thank you for your support.',
    cta: 'Become a sponsor →',
  },
];

function SlotPromoCard({ slot }: { slot: number }) {
  const { incidents } = useIncidentData();
  const card = PROMO_CARDS[(slot - 1) % PROMO_CARDS.length]!;

  const liveStats = useMemo(() => {
    if (!card.liveData) return null;

    const verified = incidents.filter(i => i.verification.startsWith('v4') || i.verification.startsWith('v5')).length;
    const verifiedPct = incidents.length > 0 ? Math.round((verified / incidents.length) * 100) : 0;
    const provinces = new Set(incidents.map(i => i.province)).size;
    const moduleCounts = Object.entries(MODULE_META).map(([key, meta]) => ({
      label: meta.label, count: incidents.filter(i => i.module === key).length, colour: meta.colour,
    })).filter(m => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);

    return { total: incidents.length, verifiedPct, provinces, moduleCounts };
  }, [incidents, card.liveData]);

  const bg = '#111827';
  const borderColor = card.accent + '44';

  return (
    <div
      className="sponsor-slot promo-card"
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, ${card.accent}11 100%)`,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 11,
        lineHeight: 1.45,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative corner glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 60, height: 60,
        background: `radial-gradient(circle, ${card.accent}18 0%, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Header row: icon + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <PromoIcon type={card.icon} color={card.accent} size={20} />
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
          color: card.accent, textTransform: 'uppercase' as const,
          background: card.accent + '15', padding: '2px 6px', borderRadius: 3,
        }}>
          {card.badge}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#e2e8f0',
        marginBottom: 4, lineHeight: 1.2,
      }}>
        {card.title}
      </div>

      {/* Body */}
      <div style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.5, marginBottom: liveStats ? 6 : 4 }}>
        {card.body}
      </div>

      {/* Live data strip */}
      {liveStats && card.icon === 'shield-check' && (
        <div style={{
          display: 'flex', gap: 10, padding: '5px 0', marginBottom: 2,
          borderTop: `1px solid ${borderColor}`,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: card.accent }}>{liveStats.verifiedPct}%</div>
            <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase' as const }}>verified</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{liveStats.total}</div>
            <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase' as const }}>tracked</div>
          </div>
        </div>
      )}

      {liveStats && card.icon === 'map-pin' && (
        <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 5, marginBottom: 2 }}>
          {liveStats.moduleCounts.map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.colour, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#94a3b8', flex: 1 }}>{m.label}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#e2e8f0' }}>{m.count}</span>
            </div>
          ))}
          <div style={{ fontSize: 8, color: '#64748b', marginTop: 3 }}>{liveStats.provinces} provinces active</div>
        </div>
      )}

      {/* CTA */}
      {card.cta && (
        <div style={{
          fontSize: 9, fontWeight: 600, color: card.accent,
          marginTop: 2, letterSpacing: '0.02em',
          cursor: 'default',
        }}>
          {card.cta}
        </div>
      )}

      {/* Footnote */}
      {card.footnote && (
        <div style={{ fontSize: 8.5, color: '#64748b', fontStyle: 'italic', marginTop: 3 }}>
          {card.footnote}
        </div>
      )}

      {/* AAIT badge */}
      <div style={{
        position: 'absolute', bottom: 4, right: 6,
        fontSize: 7, fontWeight: 700, letterSpacing: '0.12em',
        color: card.accent + '55',
      }}>
        AAIT
      </div>
    </div>
  );
}

export function SponsorSlot({ slot }: { slot: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);
  const { campaigns } = useIncidentData();
  const campaign = campaigns.find((c) => c.placement === `slot-${slot}` && c.status === 'active');

  if (!sponsorsEnabled || !campaign) {
    return <SlotPromoCard slot={slot} />;
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
