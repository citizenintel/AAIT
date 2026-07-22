import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Footer } from '../components/Footer';
import { VERIFICATION_META } from '../data/mock-incidents';

export function MethodologyPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <TopBar />
      <div className="page-content">
        <div className="page-container page-prose">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to map
          </button>

          <h1>Methodology</h1>
          <p className="page-subtitle">How we verify incidents, assess bias, and maintain source independence.</p>

          <section>
            <h2>Verification state machine</h2>
            <p>Every incident moves through a structured verification pipeline. Higher levels require stronger evidence.</p>
            <div className="methodology-states">
              {Object.entries(VERIFICATION_META).map(([key, meta]) => (
                <div key={key} className="method-state">
                  <div className="method-state-header">
                    <span className="method-state-code">{key.split('_')[0]?.toUpperCase()}</span>
                    <span className="method-state-name">{meta.label}</span>
                  </div>
                  <p>{meta.description}</p>
                </div>
              ))}
            </div>
            <div className="method-note">
              <strong>Important:</strong> V2 ("Plausible") is never displayed as "verified" to readers. The distinction between
              plausible-but-uncorroborated and corroborated-by-independent-sources is a core editorial standard.
            </div>
          </section>

          <section>
            <h2>Bias Assessment Matrix (BAM)</h2>
            <p>
              The BAM is a <strong>structured human-review framework</strong>, not an automated scoring system. When an
              incident may involve bias (racial, political, xenophobic, etc.), a trained analyst assesses it using
              three categories of indicators:
            </p>
            <div className="bam-grid">
              <div className="bam-card">
                <h3>Direct indicators</h3>
                <p>Explicit statements, slurs, symbols, or written/verbal expressions of bias by the perpetrator.</p>
              </div>
              <div className="bam-card">
                <h3>Target selection indicators</h3>
                <p>Patterns suggesting the victim was chosen based on identity characteristics — but only when supported by evidence, not assumption.</p>
              </div>
              <div className="bam-card">
                <h3>Contextual indicators</h3>
                <p>Surrounding circumstances: proximity to political events, history of bias incidents in the area, community tensions.</p>
              </div>
            </div>
            <div className="method-note">
              Every bias classification is reviewed by a minimum of two independent analysts (two-person approval).
              Alternative motives (robbery, domestic dispute, labour dispute) are explicitly assessed and documented.
            </div>
          </section>

          <section>
            <h2>Source independence</h2>
            <p>
              We track media ownership groups and syndication chains. When the same story appears in 10 outlets
              owned by the same media group, that counts as <strong>one source, not ten</strong>. Independent
              corroboration requires genuinely separate editorial processes.
            </p>
            <ul>
              <li>Each source has an underlying ownership group tracked in our database</li>
              <li>Syndication chains are traced — a republished wire story links back to the original</li>
              <li>Source reliability is tracked over time with a historical record</li>
              <li>Contradictions between sources are recorded alongside corroborations</li>
            </ul>
          </section>

          <section>
            <h2>Location privacy tiers</h2>
            <p>We protect victim and witness privacy through a tiered location system:</p>
            <table className="method-table">
              <thead>
                <tr><th>Tier</th><th>Precision</th><th>When used</th></tr>
              </thead>
              <tbody>
                <tr><td>L0</td><td>No location</td><td>Sensitive cases where any location could identify the victim</td></tr>
                <tr><td>L1</td><td>Province only</td><td>Default for most sensitive incidents</td></tr>
                <tr><td>L2</td><td>Municipality</td><td>When municipal context matters</td></tr>
                <tr><td>L3</td><td>Area/suburb</td><td>Urban incidents, general area</td></tr>
                <tr><td>L4</td><td>Approximate cell</td><td>Most published incidents — close but not exact</td></tr>
                <tr><td>L5</td><td>Exact (public)</td><td>Public locations only (government buildings, highways) — requires editor approval</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>What we do not do</h2>
            <ul>
              <li>We do not infer ethnicity, race, language, religion, or nationality from surnames, images, or addresses.</li>
              <li>We do not use facial recognition or automatic ethnicity detection.</li>
              <li>We do not create predictive-policing labels or vigilante dispatch functionality.</li>
              <li>We do not auto-publish AI output or citizen reports.</li>
              <li>We do not score bias with algorithms — all bias assessment is human-led.</li>
            </ul>
          </section>

          <section>
            <h2>Corrections and retractions</h2>
            <p>
              We operate a formal corrections process. When an error is identified, a correction notice is attached
              to the incident record and remains visible. Retracted incidents retain a public notice explaining
              why the retraction occurred — we do not silently delete.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
