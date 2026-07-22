import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Footer } from '../components/Footer';
import { MOCK_TIERS, BENEFITS } from '../data/mock-subscriptions';

export function SubscribePage() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const activeTiers = MOCK_TIERS.filter((t) => t.isActive);

  return (
    <div className="page-shell">
      <TopBar />
      <div className="page-content" style={{ overflowY: 'auto' }}>
        <div className="subscribe-hero">
          <h1>Subscribe to AAIT</h1>
          <p>Access premium incident data, analytical breakdowns, and exportable reports. Choose the plan that fits your needs — from free public access to full professional intelligence.</p>
        </div>

        <div className="subscribe-tiers">
          {activeTiers.map((tier) => (
            <div key={tier.id} className={`subscribe-card${tier.isFeatured ? ' featured' : ''}`}>
              {tier.isFeatured && <div className="sub-featured-badge" style={{ alignSelf: 'flex-start' }}>Most popular</div>}
              <div className="subscribe-card-name">{tier.name}</div>
              <div className="subscribe-card-price">
                {tier.price === 0 ? 'Free' : <>R{tier.price}<span> /{tier.period === 'monthly' ? 'month' : 'year'}</span></>}
              </div>
              <div className="subscribe-card-desc">{tier.description}</div>
              <div className="subscribe-card-benefits">
                {tier.benefits.map((b) => {
                  const meta = BENEFITS.find((x) => x.key === b);
                  return <div key={b} className="sub-benefit-check">{meta?.label ?? b}</div>;
                })}
              </div>
              {tier.price === 0 ? (
                <button className="subscribe-btn" onClick={() => setSelectedTier(null)}>Current plan</button>
              ) : (
                <button className="subscribe-btn" onClick={() => setSelectedTier(tier.id)}>
                  {selectedTier === tier.id ? 'Processing...' : `Subscribe — R${tier.price}/${tier.period === 'monthly' ? 'mo' : 'yr'}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {selectedTier && (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 32px' }}>
            <div className="admin-card" style={{ textAlign: 'center' }}>
              <h2 style={{ marginTop: 0 }}>PayPal checkout</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                You will be redirected to PayPal to complete your payment securely. AAIT never sees or stores your payment details.
              </p>
              <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', marginBottom: 12 }}>
                <svg width="80" height="20" viewBox="0 0 80 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5 }}>
                  <text x="0" y="16" fill="var(--text-muted)" fontSize="14" fontWeight="600" fontFamily="system-ui">PayPal</text>
                </svg>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  PayPal button loads here when VITE_PAYPAL_CLIENT_ID is configured
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Sandbox mode · No real payments are processed in this demo
              </div>
            </div>
          </div>
        )}

        <div className="subscribe-disclaimer">
          <strong>Subscription terms.</strong> Fees are in ZAR, non-refundable except as required by the Consumer Protection Act 68 of 2008. Subscriptions renew automatically; cancel any time before renewal. Payments are processed by PayPal &mdash; AAIT does not store your payment credentials. Data is provided &ldquo;as is&rdquo; for research purposes; AI-generated analytics must be independently verified before consequential use. Redistribution, scraping or bulk export of subscription data is prohibited. AAIT may modify pricing or benefits with 30 days&rsquo; notice. By subscribing you agree to these terms and the full <a href="#" onClick={(e) => { e.preventDefault(); document.querySelector('.site-footer-disclaimer')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }} style={{ color: 'var(--accent)' }}>Disclaimer &amp; Terms of Use</a>.
        </div>
      </div>
      <Footer />
    </div>
  );
}
