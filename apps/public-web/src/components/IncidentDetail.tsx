import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/app-store';
import { SEVERITY_META, VERIFICATION_META, MODULE_META } from '../data/mock-incidents';
import { useIncidentData } from '@/lib/hooks/useIncidentData';
import { INFERRED_FIELD_LABELS } from '@/lib/utils/inferred-fields';

export function IncidentDetail() {
  // allIncidents, not incidents: a lookup by id must never be scoped by the
  // active time window. Otherwise opening a record and then narrowing the
  // window makes the detail panel vanish with no message (line 14 returns null).
  const { allIncidents: incidents } = useIncidentData();
  const selectedId = useAppStore((s) => s.ui.selectedIncidentId);
  const setSelected = useAppStore((s) => s.setSelectedIncident);
  const navigate = useNavigate();

  const incident = incidents.find(i => i.id === selectedId);
  if (!incident) return null;

  const sev = SEVERITY_META[incident.severity];
  const ver = VERIFICATION_META[incident.verification];
  const mod = MODULE_META[incident.module];

  return (
    <div className="incident-panel">
      <div className="incident-panel-header">
        <button className="incident-panel-close" onClick={() => setSelected(null)}>×</button>
        <span className="incident-panel-module" style={{ color: mod.colour }}>{mod.label}</span>
      </div>

      <h2 className="incident-panel-title">{incident.title}</h2>

      <div className="incident-panel-badges">
        <span className="incident-badge" style={{ background: sev.colour + '22', color: sev.colour, borderColor: sev.colour }}>
          {sev.label}
        </span>
        <span className="incident-badge verification">
          {ver?.label}
        </span>
      </div>

      <div className="incident-panel-meta">
        <div className="incident-meta-row">
          <span className="incident-meta-label">Location</span>
          <span>{[incident.town, incident.province].filter(Boolean).join(', ') || 'Not stated'}</span>
        </div>
        <div className="incident-meta-row">
          <span className="incident-meta-label">Date occurred</span>
          <span>{incident.dateOccurred || 'Not stated'}</span>
        </div>
        <div className="incident-meta-row">
          <span className="incident-meta-label">Date reported</span>
          <span>{incident.dateReported}</span>
        </div>
        <div className="incident-meta-row">
          <span className="incident-meta-label">Category</span>
          <span>{incident.category.replace(/_/g, ' ')}</span>
        </div>
        <div className="incident-meta-row">
          <span className="incident-meta-label">Location tier</span>
          <span>{incident.locationTier.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* An undefined figure means the source stated no number. It is NOT a
          confirmed zero and must not be rendered as one. */}
      {((incident.casualties?.deceased ?? 0) > 0 || (incident.casualties?.injured ?? 0) > 0) && (
        <div className="incident-panel-casualties">
          {(incident.casualties?.deceased ?? 0) > 0 && <span className="casualty deceased">{incident.casualties!.deceased} deceased</span>}
          {(incident.casualties?.injured ?? 0) > 0 && <span className="casualty injured">{incident.casualties!.injured} injured</span>}
        </div>
      )}

      {/* Provenance. Machine-derived fields must never read as source-stated. */}
      {(incident.inferredFields?.length || incident.needsReview) && (
        <div className="incident-panel-inferred" style={{ marginTop: 10, padding: '8px 10px', border: '1px solid #d69e2e55', background: '#d69e2e14', borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#d69e2e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Machine-derived — not stated by the source
          </div>
          {incident.needsReview && (
            <div style={{ fontSize: 11, marginTop: 4 }}>
              This record was produced automatically and has not been confirmed by an editor. Do not cite its figures.
            </div>
          )}
          {incident.inferredFields && incident.inferredFields.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
              {incident.inferredFields.map(f => (
                <li key={f}>{INFERRED_FIELD_LABELS[f] ?? f}</li>
              ))}
            </ul>
          )}
          {incident.splitFrom && (
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
              Split out of source row <code>{incident.splitFrom.rootId}</code> by the “{incident.splitFrom.strategy}” rule.
              {incident.splitFrom.parentVictimName && <> Parent record named <strong>{incident.splitFrom.parentVictimName}</strong>; that name has NOT been attributed to this entry.</>}
              {incident.splitFrom.parentCasualties && <> Parent casualty figure: {incident.splitFrom.parentCasualties.deceased ?? '—'} deceased / {incident.splitFrom.parentCasualties.injured ?? '—'} injured (unassigned).</>}
            </div>
          )}
        </div>
      )}

      <div className="incident-panel-summary">
        <h3>Summary</h3>
        <p>{incident.summary}</p>
      </div>

      <div className="incident-panel-sources">
        <h3>Sources ({incident.sourceCount})</h3>
        <ul>
          {incident.sources.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="incident-panel-tags">
        {incident.tags.map(tag => (
          <span key={tag} className="incident-tag">{tag}</span>
        ))}
      </div>

      {incident.isSynthetic && (
        <div className="incident-panel-synthetic">
          SYNTHETIC TEST DATA — This incident is not real. It was generated for development and testing purposes.
        </div>
      )}

      <div className="incident-panel-actions">
        <button className="btn btn-primary" onClick={() => navigate(`/incident/${incident.id}`)}>
          Full details
        </button>
        <button className="btn btn-secondary" onClick={() => setSelected(null)}>
          Close
        </button>
      </div>
    </div>
  );
}
