import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { MOCK_INCIDENTS, SEVERITY_META, VERIFICATION_META, MODULE_META } from '../data/mock-incidents';

export function IncidentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const incident = MOCK_INCIDENTS.find(i => i.id === id);

  if (!incident) {
    return (
      <div className="app-shell" style={{ gridTemplateColumns: '1fr' }}>
        <TopBar />
        <div className="page-content">
          <div className="page-container">
            <h1>Incident not found</h1>
            <p>The incident you're looking for doesn't exist or has been removed.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to map</button>
          </div>
        </div>
      </div>
    );
  }

  const sev = SEVERITY_META[incident.severity];
  const ver = VERIFICATION_META[incident.verification];
  const mod = MODULE_META[incident.module];

  return (
    <div className="app-shell" style={{ gridTemplateColumns: '1fr' }}>
      <TopBar />
      <div className="page-content">
        <div className="page-container">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to map
          </button>

          <div className="incident-full">
            <div className="incident-full-header">
              <span className="incident-module-label" style={{ color: mod.colour }}>{mod.label}</span>
              <h1>{incident.title}</h1>
              <div className="incident-full-badges">
                <span className="incident-badge" style={{ background: sev.colour + '22', color: sev.colour, borderColor: sev.colour }}>{sev.label}</span>
                <span className="incident-badge verification">{ver?.label}</span>
                {incident.isSynthetic && <span className="incident-badge synthetic">Synthetic</span>}
              </div>
            </div>

            <div className="incident-full-grid">
              <div className="incident-full-main">
                <section className="incident-section">
                  <h2>Summary</h2>
                  <p>{incident.summary}</p>
                </section>

                {incident.casualties && (incident.casualties.deceased > 0 || incident.casualties.injured > 0) && (
                  <section className="incident-section">
                    <h2>Casualties</h2>
                    <div className="casualty-grid">
                      {incident.casualties.deceased > 0 && (
                        <div className="casualty-card deceased">
                          <div className="casualty-num">{incident.casualties.deceased}</div>
                          <div className="casualty-label">Deceased</div>
                        </div>
                      )}
                      {incident.casualties.injured > 0 && (
                        <div className="casualty-card injured">
                          <div className="casualty-num">{incident.casualties.injured}</div>
                          <div className="casualty-label">Injured</div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <section className="incident-section">
                  <h2>Sources ({incident.sourceCount})</h2>
                  <div className="source-list">
                    {incident.sources.map((s, i) => (
                      <div key={i} className="source-item">
                        <span className="source-num">{i + 1}</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="incident-section">
                  <h2>Verification</h2>
                  <div className="verification-detail">
                    <div className="verification-state">
                      <span className="verification-dot" style={{ borderColor: sev.colour }} />
                      <div>
                        <div className="verification-name">{ver?.label}</div>
                        <div className="verification-desc">{ver?.description}</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="incident-section">
                  <h2>Tags</h2>
                  <div className="incident-tags-full">
                    {incident.tags.map(tag => (
                      <span key={tag} className="incident-tag">{tag}</span>
                    ))}
                  </div>
                </section>
              </div>

              <div className="incident-full-sidebar">
                <div className="incident-info-card">
                  <h3>Details</h3>
                  <div className="info-row"><span>Province</span><span>{incident.province}</span></div>
                  <div className="info-row"><span>Town</span><span>{incident.town}</span></div>
                  <div className="info-row"><span>Date occurred</span><span>{incident.dateOccurred}</span></div>
                  <div className="info-row"><span>Date reported</span><span>{incident.dateReported}</span></div>
                  <div className="info-row"><span>Category</span><span>{incident.category.replace(/_/g, ' ')}</span></div>
                  <div className="info-row"><span>Module</span><span>{mod.label}</span></div>
                  <div className="info-row"><span>Location tier</span><span>{incident.locationTier.replace(/l\d_/, '').replace(/_/g, ' ')}</span></div>
                  <div className="info-row"><span>Coordinates</span><span>{incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</span></div>
                </div>

                {incident.isSynthetic && (
                  <div className="synthetic-notice">
                    <strong>Synthetic Test Data</strong>
                    <p>This incident was generated for development and testing purposes. It does not represent a real event.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
