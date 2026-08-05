import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { SEVERITY_META, VERIFICATION_META, MODULE_META } from '../data/mock-incidents';
import { fetchIncidentById } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { CorrectionForm } from '@/components/CorrectionForm';

export function IncidentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: incident, loading } = useQuery(() => fetchIncidentById(id!), [id]);
  const [showCorrection, setShowCorrection] = useState(false);

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar />
        <div className="page-content">
          <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading incident...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="page-shell">
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

  const moduleKey = incident.category?.module ?? 'ait';
  const sev = SEVERITY_META[incident.severity as keyof typeof SEVERITY_META];
  const ver = VERIFICATION_META[incident.verification_state as keyof typeof VERIFICATION_META];
  const mod = MODULE_META[moduleKey as keyof typeof MODULE_META];
  const tags = (incident.tags ?? []).map(t => typeof t === 'string' ? t : t.tag);

  return (
    <div className="page-shell">
      <TopBar />
      <div className="page-content">
        <div className="page-container">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to map
          </button>

          <div className="incident-full">
            <div className="incident-full-header">
              <span className="incident-module-label" style={{ color: mod?.colour }}>{mod?.label ?? moduleKey}</span>
              <h1>{incident.title}</h1>
              <div className="incident-full-badges">
                {sev && <span className="incident-badge" style={{ background: sev.colour + '22', color: sev.colour, borderColor: sev.colour }}>{sev.label}</span>}
                {ver && <span className="incident-badge verification">{ver.label}</span>}
                {incident.status === 'synthetic' && <span className="incident-badge synthetic">Synthetic</span>}
              </div>
            </div>

            <div className="incident-full-grid">
              <div className="incident-full-main">
                <section className="incident-section">
                  <h2>Summary</h2>
                  <p>{incident.confirmed_facts ?? incident.reported_unconfirmed ?? '—'}</p>
                </section>

                {(incident.fatality_count_confirmed || incident.injury_count_confirmed) && (
                  <section className="incident-section">
                    <h2>Casualties</h2>
                    <div className="casualty-grid">
                      {(incident.fatality_count_confirmed ?? 0) > 0 && (
                        <div className="casualty-card deceased">
                          <div className="casualty-num">{incident.fatality_count_confirmed}</div>
                          <div className="casualty-label">Deceased</div>
                        </div>
                      )}
                      {(incident.injury_count_confirmed ?? 0) > 0 && (
                        <div className="casualty-card injured">
                          <div className="casualty-num">{incident.injury_count_confirmed}</div>
                          <div className="casualty-label">Injured</div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <section className="incident-section">
                  <h2>Sources ({incident.source_count ?? 0})</h2>
                  {(incident.source_count ?? 0) > 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Source details available in the editorial view.</p>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No sources linked yet.</p>
                  )}
                </section>

                <section className="incident-section">
                  <h2>Verification</h2>
                  <div className="verification-detail">
                    <div className="verification-state">
                      <span className="verification-dot" style={{ borderColor: sev?.colour }} />
                      <div>
                        <div className="verification-name">{ver?.label ?? incident.verification_state}</div>
                        <div className="verification-desc">{ver?.description ?? ''}</div>
                      </div>
                    </div>
                  </div>
                </section>

                {tags.length > 0 && (
                  <section className="incident-section">
                    <h2>Tags</h2>
                    <div className="incident-tags-full">
                      {tags.map(tag => (
                        <span key={tag} className="incident-tag">{tag}</span>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="incident-full-sidebar">
                <div className="incident-info-card">
                  <h3>Details</h3>
                  <div className="info-row"><span>Province</span><span>{incident.location?.province ?? '—'}</span></div>
                  <div className="info-row"><span>Town</span><span>{incident.location?.town ?? '—'}</span></div>
                  {/* `|| `, not `?? ` — '' is "the source stated no date" and
                      must read as such rather than as a blank cell. */}
                  <div className="info-row"><span>Date occurred</span><span>{incident.occurred_at || 'Not stated'}</span></div>
                  <div className="info-row"><span>Date reported</span><span>{incident.published_at || incident.created_at || 'Not stated'}</span></div>
                  <div className="info-row"><span>Category</span><span>{incident.category?.label_en ?? incident.category_id}</span></div>
                  <div className="info-row"><span>Module</span><span>{mod?.label ?? moduleKey}</span></div>
                  <div className="info-row"><span>Location tier</span><span>{incident.location?.location_tier?.replace(/l\d_/, '').replace(/_/g, ' ') ?? '—'}</span></div>
                  {incident.location?.lat != null && (
                    <div className="info-row"><span>Coordinates</span><span>{incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}</span></div>
                  )}
                </div>

                {incident.status === 'synthetic' && (
                  <div className="synthetic-notice">
                    <strong>Synthetic Test Data</strong>
                    <p>This incident was generated for development and testing purposes. It does not represent a real event.</p>
                  </div>
                )}

                <button className="correction-suggest-btn" onClick={() => setShowCorrection(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Submit a Correction
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCorrection && (
        <div className="correction-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCorrection(false); }}>
          <CorrectionForm
            incidentId={incident.id}
            incidentTitle={incident.title}
            onClose={() => setShowCorrection(false)}
          />
        </div>
      )}
    </div>
  );
}
