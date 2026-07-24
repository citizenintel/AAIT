import { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { Footer } from '../components/Footer';
import { fetchTiers } from '@/lib/api/subscriptions';
import { BENEFITS } from '../data/mock-subscriptions';
import type { SubscriptionTier } from '../data/mock-subscriptions';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined;

function PayPalButton({ tier, onSuccess }: { tier: SubscriptionTier; onSuccess: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || !containerRef.current) return;

    let script = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk]');
    if (!script) {
      script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=ZAR`;
      script.setAttribute('data-paypal-sdk', 'true');
      script.async = true;
      document.head.appendChild(script);
    }

    const render = () => {
      if (!containerRef.current || !(window as any).paypal) return;
      containerRef.current.innerHTML = '';
      (window as any).paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'subscribe' },
        createOrder: (_data: any, actions: any) =>
          actions.order.create({
            purchase_units: [{
              amount: { value: tier.price.toFixed(2), currency_code: 'ZAR' },
              description: `${tier.name} subscription`,
            }],
          }),
        onApprove: async (_data: any, actions: any) => {
          await actions.order.capture();
          onSuccess();
        },
        onError: () => setError('Payment failed. Please try again.'),
      }).render(containerRef.current);
    };

    if ((window as any).paypal) {
      render();
    } else {
      script.addEventListener('load', render);
    }
  }, [tier, onSuccess]);

  return (
    <>
      <div ref={containerRef} style={{ minHeight: 50 }} />
      {error && <div style={{ color: '#c53030', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </>
  );
}

export function SubscribePage() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    fetchTiers().then(setTiers);
  }, []);

  const activeTiers = tiers.filter((t) => t.isActive);
  const chosenTier = tiers.find(t => t.id === selectedTier);

  if (paymentComplete) {
    return (
      <div className="page-shell">
        <TopBar />
        <div className="page-content" style={{ overflowY: 'auto' }}>
          <div className="page-container" style={{ maxWidth: 500, textAlign: 'center', paddingTop: 80 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            <h1 style={{ marginTop: 16 }}>Payment received</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Your {chosenTier?.name} subscription is now active. Welcome aboard.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar />
      <div className="page-content" style={{ overflowY: 'auto' }}>
        <div className="subscribe-hero">
          <h1>Subscribe to Intelligence Twin</h1>
          <p>Access premium intelligence data, analytical breakdowns, and exportable reports. Choose the plan that fits your needs — from free public access to full professional intelligence.</p>
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
                  {selectedTier === tier.id ? 'Selected' : `Subscribe — R${tier.price}/${tier.period === 'monthly' ? 'mo' : 'yr'}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {selectedTier && chosenTier && (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 32px' }}>
            <div className="admin-card" style={{ textAlign: 'center' }}>
              <h2 style={{ marginTop: 0 }}>PayPal checkout</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                You will be redirected to PayPal to complete your payment securely. Intelligence Twin never sees or stores your payment details.
              </p>
              {PAYPAL_CLIENT_ID ? (
                <PayPalButton tier={chosenTier} onSuccess={() => setPaymentComplete(true)} />
              ) : (
                <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', marginBottom: 12 }}>
                  <svg width="80" height="20" viewBox="0 0 80 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5 }}>
                    <text x="0" y="16" fill="var(--text-muted)" fontSize="14" fontWeight="600" fontFamily="system-ui">PayPal</text>
                  </svg>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    PayPal button loads here when VITE_PAYPAL_CLIENT_ID is configured
                  </div>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {PAYPAL_CLIENT_ID ? 'Sandbox mode' : 'PayPal not configured'} · No real payments are processed in this demo
              </div>
            </div>
          </div>
        )}

        <div className="subscribe-disclaimer">
          <strong>Subscription terms.</strong> Fees are in ZAR, non-refundable except as required by the Consumer Protection Act 68 of 2008. Subscriptions renew automatically; cancel any time before renewal. Payments are processed by PayPal &mdash; Intelligence Twin does not store your payment credentials. Data is provided &ldquo;as is&rdquo; for research purposes; AI-generated analytics must be independently verified before consequential use. Redistribution, scraping or bulk export of subscription data is prohibited. Intelligence Twin may modify pricing or benefits with 30 days&rsquo; notice. By subscribing you agree to these terms and the full <a href="#" onClick={(e) => { e.preventDefault(); document.querySelector('.site-footer-disclaimer')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }} style={{ color: 'var(--accent)' }}>Disclaimer &amp; Terms of Use</a>.
        </div>
      </div>
      <Footer />
    </div>
  );
}
