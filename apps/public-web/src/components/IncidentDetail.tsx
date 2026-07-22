import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/app-store';
import { MOCK_INCIDENTS, SEVERITY_META, VERIFICATION_META, MODULE_META } from '../data/mock-incidents';

export function IncidentDetail() {
  const selectedId = useAppStore((s) => s.ui.selectedIncidentId);
  const setSelected = useAppStore((s) => s.setSelectedIncident);
  const navigate = useNavigate();

  const incident = MOCK_INCIDENTS.find(i => i.id === selectedId);
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
          <span>{incident.town}, {incident.province}</span>
        </div>
        <div className="incident-meta-row">
          <span className="incident-meta-label">Date occurred</span>
          <span>{incident.dateOccurred}</span>
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

      {incident.casualties && (incident.casualties.deceased > 0 || incident.casualties.injured > 0) && (
        <div className="incident-panel-casualties">
          {incident.casualties.deceased > 0 && <span className="casualty deceased">{incident.casualties.deceased} deceased</span>}
          {incident.casualties.injured > 0 && <span className="casualty injured">{incident.casualties.injured} injured</span>}
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
