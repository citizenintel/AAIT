import { useMemo } from 'react';
import { useAppStore } from '@/stores/app-store';

export function AdminCorrections() {
  const corrections = useAppStore((s) => s.corrections);
  const updateCorrectionStatus = useAppStore((s) => s.updateCorrectionStatus);

  const pending = useMemo(() => corrections.filter((c) => c.status === 'pending'), [corrections]);
  const resolved = useMemo(() => corrections.filter((c) => c.status !== 'pending'), [corrections]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Corrections</h1>
        <span className="admin-page-count">
          {pending.length} pending
        </span>
      </div>

      {pending.length === 0 && resolved.length === 0 && (
        <div className="admin-empty">No corrections have been submitted yet.</div>
      )}

      {pending.length > 0 && (
        <section className="admin-section">
          <h2 className="admin-section-title">Pending Review ({pending.length})</h2>
          <div className="corrections-list">
            {pending.map((c) => (
              <div key={c.id} className="correction-card">
                <div className="correction-card-header">
                  <span className="correction-card-incident">{c.incidentTitle}</span>
                  <span className="correction-card-date">
                    {new Date(c.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="correction-card-field">
                  Field: <strong>{c.field}</strong>
                </div>
                {c.currentValue && (
                  <div className="correction-card-current">
                    Current: <span className="correction-val-old">{c.currentValue}</span>
                  </div>
                )}
                <div className="correction-card-suggested">
                  Suggested: <span className="correction-val-new">{c.suggestedValue}</span>
                </div>
                <div className="correction-card-reason">
                  Reason: {c.reason}
                </div>
                {(c.submitterName || c.submitterEmail) && (
                  <div className="correction-card-submitter">
                    From: {c.submitterName}{c.submitterEmail ? ` (${c.submitterEmail})` : ''}
                  </div>
                )}
                <div className="correction-card-actions">
                  <button
                    className="correction-accept-btn"
                    onClick={() => updateCorrectionStatus(c.id, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    className="correction-dismiss-btn"
                    onClick={() => updateCorrectionStatus(c.id, 'dismissed')}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section className="admin-section">
          <h2 className="admin-section-title">Resolved ({resolved.length})</h2>
          <div className="corrections-list">
            {resolved.map((c) => (
              <div key={c.id} className="correction-card resolved" data-status={c.status}>
                <div className="correction-card-header">
                  <span className="correction-card-incident">{c.incidentTitle}</span>
                  <span className={`correction-status-badge ${c.status}`}>
                    {c.status}
                  </span>
                </div>
                <div className="correction-card-field">
                  Field: <strong>{c.field}</strong>
                </div>
                <div className="correction-card-suggested">
                  Suggested: {c.suggestedValue}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
