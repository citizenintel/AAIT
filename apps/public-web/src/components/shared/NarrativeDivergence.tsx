'use client';

import type {
  NarrativeDivergence as NarrativeDivergenceType,
  ExclusiveClaim,
  CorrectedClaim,
} from '@/types/ontology';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NarrativeDivergenceProps {
  divergence: NarrativeDivergenceType | null;
}

export default function NarrativeDivergence({ divergence }: NarrativeDivergenceProps) {
  if (!divergence) {
    return (
      <div
        style={{
          padding: 'var(--sp-6)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        No narrative analysis available for this event.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {/* Source group cards */}
      <div className="narrative-grid">
        {divergence.sourceGroups.map((group) => (
          <div className="narrative-card" data-type={group.type} key={group.type}>
            <div className="narrative-card-label">{group.label}</div>
            <div className="narrative-card-emphasis">{group.emphasis}</div>
            {group.sources.length > 0 && (
              <div
                style={{
                  marginTop: 'var(--sp-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {group.sources.length} source{group.sources.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Common facts */}
      {divergence.commonFacts.length > 0 && (
        <div className="narrative-section">
          <div className="narrative-section-title">Common Facts</div>
          {divergence.commonFacts.map((fact, i) => (
            <div className="narrative-fact" key={i}>
              <span style={{ color: 'var(--status-low)', flexShrink: 0 }}>{'✓'}</span>
              <span>{fact}</span>
            </div>
          ))}
        </div>
      )}

      {/* Exclusive claims */}
      {divergence.exclusiveClaims.length > 0 && (
        <div className="narrative-section">
          <div className="narrative-section-title">Exclusive Claims</div>
          {divergence.exclusiveClaims.map((claim: ExclusiveClaim, i: number) => (
            <div
              className="narrative-claim"
              data-contradicted={claim.contradicted ? 'true' : undefined}
              key={i}
            >
              <span style={{ color: 'var(--status-medium)', flexShrink: 0, fontSize: 'var(--text-lg)' }}>
                {'⚠'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    textDecoration: claim.contradicted ? 'line-through' : 'none',
                  }}
                >
                  {claim.claim}
                </div>
                <div className="narrative-claim-source">
                  Source: {claim.sourceGroup}
                  {claim.verifiedLater && (
                    <span style={{ marginLeft: 'var(--sp-2)', color: 'var(--status-low)' }}>
                      {'✓'} Verified later
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Corrected claims */}
      {divergence.correctedClaims.length > 0 && (
        <div className="narrative-section">
          <div className="narrative-section-title">Corrected Claims</div>
          {divergence.correctedClaims.map((claim: CorrectedClaim, i: number) => (
            <div
              key={i}
              style={{
                padding: 'var(--sp-3)',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--sp-2)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-tertiary)',
                  textDecoration: 'line-through',
                  marginBottom: 'var(--sp-1)',
                }}
              >
                {claim.original}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                }}
              >
                {claim.corrected}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                  marginTop: 'var(--sp-1)',
                }}
              >
                Corrected by {claim.correctedBy} on{' '}
                {formatDate(claim.correctedAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coordinated wording warning */}
      {divergence.coordinatedWording && (
        <div
          style={{
            padding: 'var(--sp-3)',
            background: 'rgba(239, 68, 68, 0.06)',
            borderLeft: '2px solid var(--status-critical)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--status-critical)',
              marginBottom: 'var(--sp-1)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Coordinated Wording Detected
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {divergence.coordinatedWording}
          </div>
        </div>
      )}
    </div>
  );
}
