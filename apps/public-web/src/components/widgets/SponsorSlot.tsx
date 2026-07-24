import { useAppStore } from '../../store/app-store';
import { useIncidentData } from '../../lib/hooks/useIncidentData';
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

export function SponsorSlot({ slot }: { slot: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const sponsorsEnabled = useAppStore((s) => s.sponsorsEnabled);
  const { campaigns } = useIncidentData();
  const campaign = campaigns.find((c) => c.placement === `slot-${slot}` && c.status === 'active');

  if (!sponsorsEnabled || !campaign) return null;

  // Map CampaignRow to display fields (styling defaults until DB schema carries visual overrides)
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
