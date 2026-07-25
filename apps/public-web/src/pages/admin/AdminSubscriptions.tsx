import { useState, useMemo, useEffect } from 'react';
import {
  BENEFITS,
  type SubscriptionTier, type Subscriber, type BenefitKey, type BillingPeriod,
} from '../../data/mock-subscriptions';
import { fetchTiers, fetchSubscribers, updateTier } from '@/lib/api/subscriptions';
import { useQuery } from '@/lib/hooks/useQuery';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#38a16922', color: '#38a169', label: 'Active' },
  cancelled: { bg: '#c5303022', color: '#c53030', label: 'Cancelled' },
  expired: { bg: '#8a94a622', color: '#8a94a6', label: 'Expired' },
  past_due: { bg: '#ed893622', color: '#ed8936', label: 'Past due' },
};

const EMPTY_TIER: Omit<SubscriptionTier, 'id'> = {
  name: '', price: 0, currency: 'ZAR', period: 'monthly',
  benefits: [], isActive: true, isFeatured: false,
  maxSubscribers: null, description: '',
};

export function AdminSubscriptions() {
  const { data: tiersData, loading: tiersLoading, error: tiersError, refetch: refetchTiers } = useQuery(fetchTiers, []);
  const { data: subscribersData, loading: subsLoading, error: subsError } = useQuery(fetchSubscribers, []);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const subscribers = subscribersData ?? [];

  useEffect(() => { if (tiersData) setTiers(tiersData); }, [tiersData]);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<SubscriptionTier, 'id'>>(EMPTY_TIER);
  const [showAdd, setShowAdd] = useState(false);

  const revenue = useMemo(() => {
    let monthly = 0;
    for (const sub of subscribers) {
      if (sub.status !== 'active') continue;
      const tier = tiers.find((t) => t.id === sub.tierId);
      if (tier) monthly += tier.price;
    }
    return { monthly, yearly: monthly * 12, activeSubs: subscribers.filter((s) => s.status === 'active').length };
  }, [tiers, subscribers]);

  const openEdit = (tier: SubscriptionTier) => {
    setEditId(tier.id);
    setDraft({ name: tier.name, price: tier.price, currency: tier.currency, period: tier.period, benefits: [...tier.benefits], isActive: tier.isActive, isFeatured: tier.isFeatured, maxSubscribers: tier.maxSubscribers, description: tier.description });
    setShowAdd(false);
  };

  const openAdd = () => {
    setEditId(null);
    setDraft({ ...EMPTY_TIER });
    setShowAdd(true);
  };

  const toggleBenefit = (key: BenefitKey) => {
    setDraft((d) => ({
      ...d,
      benefits: d.benefits.includes(key) ? d.benefits.filter((b) => b !== key) : [...d.benefits, key],
    }));
  };

  const saveTier = async () => {
    if (!draft.name.trim()) return;
    if (editId) {
      try {
        await updateTier(editId, draft);
        refetchTiers();
      } catch {
        // Fallback: apply locally if API fails
        setTiers((prev) => prev.map((t) => (t.id === editId ? { ...t, ...draft } : t)));
      }
    } else {
      setTiers((prev) => [...prev, { id: `tier-${Date.now().toString(36)}`, ...draft }]);
    }
    setEditId(null);
    setShowAdd(false);
  };

  const deleteTier = (id: string) => {
    if (id === 'tier-free') return;
    setTiers((prev) => prev.filter((t) => t.id !== id));
    if (editId === id) { setEditId(null); setShowAdd(false); }
  };

  const tierName = (id: string) => tiers.find((t) => t.id === id)?.name ?? id;
  const isEditing = editId !== null || showAdd;

  if (tiersLoading || subsLoading) return <div className="admin-page"><p>Loading subscriptions...</p></div>;
  if (tiersError || subsError) return <div className="admin-page"><p className="error-text">Error: {tiersError || subsError}</p></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Subscriptions &amp; Payments</h1>
        <p>Configure subscription tiers, set pricing, assign benefits, and manage subscribers. Payments are processed through PayPal — the receiver address is configured server-side and never shown here.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-value">{revenue.activeSubs}</div><div className="stat-label">Active subscribers</div></div>
        <div className="stat-card"><div className="stat-value">R{revenue.monthly.toLocaleString()}</div><div className="stat-label">Monthly revenue</div></div>
        <div className="stat-card"><div className="stat-value">R{revenue.yearly.toLocaleString()}</div><div className="stat-label">Projected yearly</div></div>
        <div className="stat-card"><div className="stat-value">{tiers.filter((t) => t.isActive).length}</div><div className="stat-label">Active tiers</div></div>
      </div>

      {/* Tier cards */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Subscription tiers</h2>
          <button className="btn btn-primary" onClick={openAdd}>+ Add tier</button>
        </div>

        <div className="sub-tier-grid">
          {tiers.map((tier) => (
            <div key={tier.id} className={`sub-tier-card${tier.isFeatured ? ' featured' : ''}${!tier.isActive ? ' inactive' : ''}`}>
              <div className="sub-tier-head">
                <div className="sub-tier-name">{tier.name}{tier.isFeatured && <span className="sub-featured-badge">Popular</span>}</div>
                {!tier.isActive && <span className="sub-inactive-badge">Inactive</span>}
              </div>
              <div className="sub-tier-price">
                {tier.price === 0 ? 'Free' : <>R{tier.price}<span>/{tier.period === 'monthly' ? 'mo' : 'yr'}</span></>}
              </div>
              <div className="sub-tier-desc">{tier.description}</div>
              <div className="sub-tier-benefits">
                {tier.benefits.map((b) => {
                  const meta = BENEFITS.find((x) => x.key === b);
                  return <div key={b} className="sub-benefit-check">{meta?.label ?? b}</div>;
                })}
              </div>
              <div className="sub-tier-meta">
                {tier.maxSubscribers && <span>Max: {tier.maxSubscribers} subscribers</span>}
                <span>{subscribers.filter((s) => s.tierId === tier.id && s.status === 'active').length} active</span>
              </div>
              <div className="sub-tier-actions">
                <button className="btn btn-small" onClick={() => openEdit(tier)}>Edit</button>
                {tier.id !== 'tier-free' && <button className="btn btn-small btn-danger" onClick={() => deleteTier(tier.id)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier editor */}
      {isEditing && (
        <div className="admin-card" style={{ borderColor: 'var(--accent)' }}>
          <h2>{editId ? `Edit "${tierName(editId)}"` : 'Add new tier'}</h2>

          <div className="sub-edit-grid">
            <div>
              <label className="sub-edit-label">Tier name</label>
              <input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Premium" />
            </div>
            <div>
              <label className="sub-edit-label">Price (ZAR)</label>
              <input className="form-input" type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
            </div>
            <div>
              <label className="sub-edit-label">Billing period</label>
              <select className="form-input" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value as BillingPeriod })}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="sub-edit-label">Max subscribers</label>
              <input className="form-input" type="number" min={0} value={draft.maxSubscribers ?? ''} onChange={(e) => setDraft({ ...draft, maxSubscribers: e.target.value ? Number(e.target.value) : null })} placeholder="Unlimited" />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="sub-edit-label">Description</label>
            <input className="form-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Short description for subscribers" />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="sub-edit-label">Benefits — tick what this tier includes</label>
            <div className="sub-benefits-grid">
              {BENEFITS.map((b) => (
                <label key={b.key} className="perm-item">
                  <input type="checkbox" checked={draft.benefits.includes(b.key)} onChange={() => toggleBenefit(b.key)} />
                  <span>
                    <span className="perm-item-label">{b.label}</span>
                    <span className="perm-item-desc">{b.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <label className="toggle-switch">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <span className="toggle-slider" />
              <span className="toggle-label">Active</span>
            </label>
            <label className="toggle-switch">
              <input type="checkbox" checked={draft.isFeatured} onChange={(e) => setDraft({ ...draft, isFeatured: e.target.checked })} />
              <span className="toggle-slider" />
              <span className="toggle-label">Featured (highlighted to subscribers)</span>
            </label>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => { setEditId(null); setShowAdd(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTier}>Save tier</button>
          </div>
        </div>
      )}

      {/* PayPal integration info */}
      <div className="admin-card">
        <h2>Payment integration</h2>
        <div className="settings-info">
          <div className="info-row"><span>Provider</span><span>PayPal</span></div>
          <div className="info-row"><span>Receiver email</span><span>Configured server-side (PAYPAL_RECEIVER_EMAIL)</span></div>
          <div className="info-row"><span>Client ID</span><span>{import.meta.env.VITE_PAYPAL_CLIENT_ID ? 'Configured' : 'Not set (VITE_PAYPAL_CLIENT_ID)'}</span></div>
          <div className="info-row"><span>Mode</span><span>Sandbox (switch to Live in .env)</span></div>
          <div className="info-row"><span>Webhook</span><span>Configured server-side (PAYPAL_WEBHOOK_SECRET)</span></div>
        </div>
        <div className="admin-note" style={{ marginTop: 12 }}>
          To enable live payments: (1) set VITE_PAYPAL_CLIENT_ID to your PayPal app client ID, (2) set PAYPAL_RECEIVER_EMAIL and PAYPAL_WEBHOOK_SECRET server-side. The receiver email is never exposed in frontend code.
        </div>
      </div>

      {/* Subscribers table */}
      <div className="admin-card">
        <h2>Subscribers</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Tier</th><th>Status</th><th>Start</th><th>End</th><th>PayPal ID</th></tr>
          </thead>
          <tbody>
            {subscribers.map((sub) => {
              const st = STATUS_STYLES[sub.status] ?? STATUS_STYLES.active!;
              return (
                <tr key={sub.id}>
                  <td className="td-title">{sub.name.replace(' DEMO', '')}{sub.isDemo && <span className="demo-tag">DEMO</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.email}</td>
                  <td><span style={{ fontWeight: 500 }}>{tierName(sub.tierId)}</span></td>
                  <td><span className="table-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.startDate}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.endDate}</td>
                  <td><code className="id-code">{sub.paypalTransactionId}</code></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Subscription disclaimer */}
      <div className="admin-card sub-disclaimer-card">
        <h2>Subscriber-facing disclaimer (small print)</h2>
        <div className="sub-disclaimer-preview">
          <p><strong>Subscription Terms &amp; Conditions.</strong></p>
          <p><strong>1. Fees &amp; refunds.</strong> Subscription fees are as stated at the time of purchase and are denominated in South African Rand (ZAR). Fees are non-refundable except as required by the Consumer Protection Act 68 of 2008 (&ldquo;CPA&rdquo;), which entitles you to cancel a fixed-term agreement on 20 business days&rsquo; written notice, subject to a reasonable cancellation penalty not exceeding the lesser of the amount the CPA permits or the remaining fees due. If you believe a charge is in error, contact us within 30 days of the transaction.</p>
          <p><strong>2. Billing &amp; renewal.</strong> Subscriptions renew automatically at the end of each billing period (monthly or yearly, as selected) unless cancelled before the renewal date. You may cancel at any time through your account settings or by contacting us. Cancellation takes effect at the end of the current billing period; no partial refunds are given for unused portions unless required by law.</p>
          <p><strong>3. Payment processing.</strong> Payments are processed securely by PayPal. Intelligence Twin (the &ldquo;Platform&rdquo;) does not receive, store or have access to your full payment credentials at any time. You are subject to PayPal&rsquo;s own terms of service and privacy policy in addition to these terms.</p>
          <p><strong>4. Data availability &amp; accuracy.</strong> Subscription benefits are subject to data availability &mdash; not all incident categories, provinces or time periods may have active data at any given time. Intelligence Twin makes no warranties, express or implied, regarding the completeness, accuracy, timeliness or fitness for any purpose of the data provided through any subscription tier. Data is provided &ldquo;as is&rdquo; for research and awareness purposes only and must not be relied upon as the sole basis for any legal, security, insurance, financial or other professional decision.</p>
          <p><strong>5. AI-generated analytics.</strong> Premium analytical breakdowns, summaries and trend data may be generated or assisted by artificial intelligence. AI-generated content is reviewed by human editors but may contain errors, omissions or inaccuracies. AI tools are never used to infer any person&rsquo;s race, ethnicity, religion, nationality or other protected characteristic. Subscribers must independently verify AI-generated analytics before use in reporting, legal proceedings, insurance claims or any consequential decision-making. Intelligence Twin accepts no liability for decisions made in reliance on AI-generated content.</p>
          <p><strong>6. Permitted use &amp; restrictions.</strong> Subscription data and analytics are licensed for personal research and reporting use only. You may not: (a) redistribute, republish, resell or sub-license subscription data or analytics to any third party; (b) scrape, data-mine, bulk-export or systematically extract data beyond what the subscription interface provides; (c) use subscription data or analytics to harass, defame, surveil, identify or take action against any person; or (d) use subscription data for purposes that violate the Platform&rsquo;s Disclaimer &amp; Terms of Use or any applicable law. Violation may result in immediate termination of your subscription without refund.</p>
          <p><strong>7. Changes to subscriptions.</strong> Intelligence Twin reserves the right to modify subscription pricing, benefits, or tier structure with not less than 30 days&rsquo; prior notice. Notice will be provided via the email address associated with your account. Continued use after the effective date of a change constitutes acceptance. If you do not accept a change, you may cancel before the next renewal.</p>
          <p><strong>8. Privacy.</strong> Your personal information is processed in accordance with the Protection of Personal Information Act 4 of 2013 (&ldquo;POPIA&rdquo;) and the Platform&rsquo;s privacy practices as set out in the Disclaimer &amp; Terms of Use. Subscription activity data is used solely to provide the service and for aggregate, anonymised analytics.</p>
          <p><strong>9. General.</strong> These subscription terms form part of, and are subject to, the Platform&rsquo;s full Disclaimer &amp; Terms of Use. To the extent of any conflict, the Disclaimer &amp; Terms of Use prevail. These terms are governed by the laws of the Republic of South Africa. You consent to the exclusive jurisdiction of the courts of the Republic of South Africa.</p>
          <p><strong>10. Electronic agreement.</strong> By completing the subscription payment you confirm that you have read, understood and agreed to these terms and the Platform&rsquo;s full Disclaimer &amp; Terms of Use. This constitutes an agreement concluded by electronic means in terms of the Electronic Communications and Transactions Act 25 of 2002.</p>
        </div>
      </div>

      <div className="admin-note">
        All subscription data shown is synthetic DEMO data. In production, PayPal IPN/webhooks verify payments server-side, and subscription status is enforced by the database (row-level security).
      </div>
    </div>
  );
}
