import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Footer } from '../components/Footer';
import { ContactEmail } from '../components/ContactEmail';

export function AboutPage() {
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

          <h1>About Alt Afrikaner Incident Tracker</h1>

          <section>
            <h2>Mission</h2>
            <p>
              The Alt Afrikaner Incident Tracker (AAIT) is a map-first, evidence-led citizen-intelligence platform
              for South Africa. We track, verify, and visualise incidents that mainstream reporting often
              undercounts, fragments, or ignores — from farm attacks to infrastructure failures, civil unrest
              to environmental events.
            </p>
            <p>
              Every incident on this platform is sourced, verified, and editorially reviewed. We do not
              publish speculation. We do not infer motives from demographics. We follow evidence.
            </p>
          </section>

          <section>
            <h2>What we track</h2>
            <div className="about-modules">
              <div className="about-module">
                <h3 style={{ color: '#c53030' }}>AAIT — Farm &amp; Rural</h3>
                <p>Farm attacks, farm murders, smallholding attacks, livestock theft, rural road attacks, land invasions, and related agricultural security incidents.</p>
              </div>
              <div className="about-module">
                <h3 style={{ color: '#ed8936' }}>Unrest Watch</h3>
                <p>Protests, riots, looting, taxi violence, political violence, service delivery protests, and civil unrest events.</p>
              </div>
              <div className="about-module">
                <h3 style={{ color: '#805ad5' }}>Bias Monitor</h3>
                <p>Hate crimes, xenophobic violence, political intimidation, and incidents where bias indicators are present. Assessed using a structured human-review methodology.</p>
              </div>
              <div className="about-module">
                <h3 style={{ color: '#3182ce' }}>Infrastructure Watch</h3>
                <p>Electricity disruptions, water failures, telecom outages, municipal service breakdowns, and sabotage events.</p>
              </div>
              <div className="about-module">
                <h3 style={{ color: '#38a169' }}>Natural Events</h3>
                <p>Fires, floods, droughts, severe storms, and environmental incidents affecting communities.</p>
              </div>
            </div>
          </section>

          <section>
            <h2>Principles</h2>
            <ul>
              <li><strong>Evidence first.</strong> Every claim must be sourced. AI output never publishes automatically.</li>
              <li><strong>Source independence.</strong> 10 copies of the same wire story are not 10 sources. We trace ownership groups and syndication chains.</li>
              <li><strong>No automated bias scoring.</strong> Bias is assessed by trained humans using a structured methodology — never by algorithm.</li>
              <li><strong>Privacy by design.</strong> Location precision is tiered. Exact coordinates require editorial approval. Identity documents are encrypted and auto-deleted.</li>
              <li><strong>Citizen reports never auto-publish.</strong> Every submission goes through editorial review.</li>
              <li><strong>No identity inference.</strong> We never infer ethnicity, race, language, or religion from names, images, or addresses.</li>
            </ul>
          </section>

          <section>
            <h2>How to contribute</h2>
            <p>
              Anyone can <a onClick={() => navigate('/report')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>submit a report</a>.
              Reports go through our verification pipeline — we'll check sources, corroborate with independent evidence,
              and assign a verification level before publication.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              For enquiries, corrections, or press requests: <ContactEmail />
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
