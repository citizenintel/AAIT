import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Thin site footer. Left side is free space for links of our choosing; right side
 * carries the Disclaimer button, which opens the full notice. Terms text is a
 * starting draft and should be reviewed by a qualified South African attorney.
 */
export function Footer() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <button onClick={() => navigate('/about')}>About</button>
        <button onClick={() => navigate('/methodology')}>Methodology</button>
        <button onClick={() => navigate('/report')}>Report an incident</button>
        <button onClick={() => navigate('/subscribe')}>Subscribe</button>
        <span className="site-footer-sep">·</span>
        <span className="site-footer-note">Synthetic test data · not an official or emergency service</span>
      </div>
      <div className="site-footer-right">
        <span className="site-footer-copy">© {new Date().getFullYear()} Intelligence Twin</span>
        <button className="site-footer-disclaimer" onClick={() => setOpen(true)}>Disclaimer</button>
      </div>

      {open && <DisclaimerModal onClose={() => setOpen(false)} />}
    </footer>
  );
}

function DisclaimerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card disclaimer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Disclaimer &amp; Terms of Use</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body disclaimer-body">
          <p className="disclaimer-lead">
            By accessing or using the Intelligence Twin (the &ldquo;Platform&rdquo;) you acknowledge that you have read,
            understood and agreed to the terms below. If you do not agree, do not use the Platform.
          </p>

          <h3>1. Nature of the service</h3>
          <p>The Platform is an independent situational-awareness and research tool that maps and summarises incident reports drawn from members of the public and third-party sources. It is <strong>not</strong> an official, governmental or law-enforcement service, and it is <strong>not</strong> an emergency service. In an emergency, contact the South African Police Service on <strong>10111</strong> or emergency services on <strong>112</strong>.</p>

          <h3>2. No warranty of accuracy</h3>
          <p>Information is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, whether express, implied or statutory, including but not limited to implied warranties of merchantability, fitness for a particular purpose and non-infringement. Content may be incomplete, unverified, delayed, superseded or incorrect. Verification labels indicate our <em>assessed level of confidence</em> at a point in time &mdash; they are not a guarantee of truth.</p>

          <h3>3. Development &amp; synthetic data</h3>
          <p>During development the Platform displays <strong>synthetic (demo) test data</strong>. Such data does not depict real people, events, cases or locations unless explicitly and clearly stated otherwise.</p>

          <h3>4. User-generated &amp; third-party content</h3>
          <p>Reports may be submitted by members of the public and aggregated from third-party sources. Such content reflects the views of its authors, not ours, and its inclusion does not constitute an endorsement, adoption or verification by the Platform or its operators. We do not independently confirm every item and accept no responsibility for user-generated content.</p>

          <h3>5. No allegation of guilt &mdash; presumption of innocence</h3>
          <p>Any reference to an alleged incident, and any person, entity or property mentioned, is <strong>alleged and unproven</strong> unless a court of competent jurisdiction has determined otherwise. Nothing on the Platform asserts or implies that any named or identifiable person has committed a crime or is guilty of any wrongdoing. Every person is presumed innocent until proven guilty in accordance with the Constitution of the Republic of South Africa, 1996 (section 35(3)(h)).</p>

          <h3>6. Not professional advice</h3>
          <p>Nothing on the Platform constitutes legal, security, safety, medical, financial, insurance or other professional advice. Content must not be relied upon as a basis for any decision or action. Obtain independent advice from a suitably qualified professional before acting.</p>

          <h3>7. Limitation of liability &amp; indemnity</h3>
          <p>To the fullest extent permitted by applicable law, the Platform, its operators, directors, employees, agents, contributors and licensors (collectively, the &ldquo;Released Parties&rdquo;) shall not be liable for any direct, indirect, incidental, special, consequential or punitive damages, or any loss of profits, data, use, goodwill or other intangible losses, arising out of or in connection with your access to, use of, or inability to use the Platform or any content on it, whether based on warranty, contract, delict (including negligence), statute or any other legal theory, and whether or not the Released Parties have been advised of the possibility of such damage. Your use of the Platform is entirely at your own risk.</p>
          <p>You agree to indemnify and hold harmless the Released Parties from and against any claims, damages, losses, liabilities, costs and expenses (including reasonable legal fees) arising from your use of the Platform, your violation of these terms, or your violation of any rights of a third party.</p>

          <h3>8. Acceptable use &mdash; no vigilantism or harassment</h3>
          <p>You may not use the Platform or any information obtained from it to: (a) harass, threaten, intimidate, defame, stalk, surveil, identify, locate or take any form of action against any person; (b) incite, plan, co-ordinate or carry out violence, vigilante activity or any unlawful conduct; (c) discriminate against any person on the basis of race, gender, sex, pregnancy, marital status, ethnic or social origin, colour, sexual orientation, age, disability, religion, conscience, belief, culture, language or birth; (d) scrape, data-mine, reverse-engineer or systematically extract data except as expressly permitted; or (e) use the Platform for any commercial purpose not authorised by the operator. Violation may result in immediate suspension of access and, where appropriate, referral to law enforcement.</p>

          <h3>9. Protection of personal information (POPIA)</h3>
          <p>We process personal information in accordance with the Protection of Personal Information Act 4 of 2013 (&ldquo;POPIA&rdquo;). We collect and process the minimum personal information necessary for the purposes set out in this notice. Personal information submitted by reporters is handled as confidential and is accessible only to authorised editorial personnel. Sensitive personal information, including any self-reported motive or contextual data, is retained for analytical purposes and is never published or made available to the general public.</p>
          <p>As a data subject you have the right to: (a) request access to personal information we hold about you; (b) request correction or deletion of that information; (c) object to the processing of your personal information; and (d) lodge a complaint with the Information Regulator. Contact us to exercise these rights.</p>

          <h3>10. Reporter obligations</h3>
          <p>By submitting a report you warrant that: (a) the information is true and correct to the best of your knowledge; (b) you are not submitting the report to harass, defame or otherwise harm any person; (c) you consent to the editorial team reviewing, summarising and potentially publishing a redacted version of your report; and (d) you understand that deliberately false or malicious reports may result in permanent suspension and, where warranted, legal action. The Platform reserves the right to decline, remove or amend any report at its sole discretion.</p>

          <h3>11. AI-generated summaries</h3>
          <p>Certain content on the Platform may be generated or summarised with the assistance of artificial intelligence (&ldquo;AI&rdquo;) tools. AI-generated content is reviewed by a human editor before publication but may contain errors, omissions or inaccuracies. AI is never used to infer a person&rsquo;s race, ethnicity, religion, nationality or other protected characteristic. The Released Parties accept no liability for errors in AI-generated content.</p>

          <h3>12. Corrections, complaints &amp; takedowns</h3>
          <p>If you believe any content is inaccurate, unfairly prejudicial, defamatory, or infringes your rights (including rights under POPIA, the Promotion of Equality and Prevention of Unfair Discrimination Act 4 of 2000, or the law of defamation), contact us with sufficient details to identify the content and the basis of your complaint. We will review the matter in good faith and, where appropriate, correct, retract or remove the content within a reasonable time. Nothing in this clause limits your right to seek relief from a court or regulatory body.</p>

          <h3>13. Intellectual property</h3>
          <p>The Platform&rsquo;s software, design, logos and original editorial content are the property of the operator or its licensors and are protected by applicable intellectual property laws. Third-party material is referenced for reporting, commentary and research purposes with sources attributed by their web address. Trademarks belong to their respective owners. You may not reproduce, distribute or create derivative works from Platform content without prior written consent, except as permitted by the Copyright Act 98 of 1978 or other applicable law.</p>

          <h3>14. Paid subscriptions</h3>
          <p>The Platform may offer paid subscription tiers providing access to additional data, analytics and features. Subscription fees are as stated at the time of purchase and are non-refundable except as required by the Consumer Protection Act 68 of 2008 (&ldquo;CPA&rdquo;). Subscriptions renew automatically unless cancelled before the renewal date. The operator reserves the right to modify subscription pricing or benefits with 30 days&rsquo; notice. Subscriber data and analytics are provided for personal research and reporting purposes only and may not be redistributed, republished or resold without prior written consent.</p>

          <h3>15. Electronic communications (ECTA)</h3>
          <p>This notice constitutes an agreement concluded by electronic means in terms of the Electronic Communications and Transactions Act 25 of 2002 (&ldquo;ECTA&rdquo;). Data messages sent to or from the Platform have legal effect to the extent provided by ECTA.</p>

          <h3>16. Severability</h3>
          <p>If any provision of this notice is found to be invalid, illegal or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.</p>

          <h3>17. Amendments &amp; governing law</h3>
          <p>We may amend this notice at any time by posting the updated version on the Platform. Continued use after amendment constitutes acceptance of the current version. This notice, and any dispute arising out of or in connection with it, is governed by the laws of the Republic of South Africa. You consent to the exclusive jurisdiction of the courts of the Republic of South Africa.</p>

          <p className="disclaimer-foot" style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <strong>Effective date:</strong> This version of the notice takes effect on the date the Platform is first made publicly available.<br />
            <strong>Contact:</strong> To exercise your rights, report inaccuracies, request takedowns or lodge a complaint, contact the operator via the contact details provided on the Platform.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>I understand</button>
        </div>
      </div>
    </div>
  );
}
