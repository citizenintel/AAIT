import { useState } from 'react';

interface ScanResult {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  virusScan: 'clean' | 'threat' | 'warning' | 'pending' | 'error';
  malwareScan: 'clean' | 'threat' | 'warning' | 'pending' | 'error';
  codeScan: 'clean' | 'threat' | 'warning' | 'pending' | 'error';
  phishingScan: 'clean' | 'threat' | 'warning' | 'pending' | 'error';
  details: string;
}

const STATUS_COLORS: Record<string, string> = {
  clean: '#22c55e',
  threat: '#ef4444',
  warning: '#eab308',
  pending: '#a1a1a6',
  error: '#f97316',
};

const STATUS_LABELS: Record<string, string> = {
  clean: 'Clean',
  threat: 'Threat Detected',
  warning: 'Warning',
  pending: 'Scanning...',
  error: 'Scan Failed',
};

const DEMO_SCANS: ScanResult[] = [
  {
    id: 'scan-001', fileName: 'incident_report.csv', fileSize: '24 KB',
    uploadedAt: '2026-07-24 14:30', virusScan: 'clean', malwareScan: 'clean',
    codeScan: 'clean', phishingScan: 'clean', details: 'All scans passed. No threats detected.',
  },
  {
    id: 'scan-002', fileName: 'security_footage.mp4', fileSize: '7.3 MB',
    uploadedAt: '2026-07-24 09:12', virusScan: 'clean', malwareScan: 'clean',
    codeScan: 'clean', phishingScan: 'clean', details: 'Video file verified. No embedded scripts or payloads.',
  },
  {
    id: 'scan-003', fileName: 'anonymous_tip.docx', fileSize: '156 KB',
    uploadedAt: '2026-07-23 22:45', virusScan: 'clean', malwareScan: 'warning',
    codeScan: 'warning', phishingScan: 'clean', details: 'Document contains macros. Macros have been stripped before storage. Original quarantined.',
  },
  {
    id: 'scan-004', fileName: 'evidence_photo.jpg', fileSize: '2.1 MB',
    uploadedAt: '2026-07-23 18:00', virusScan: 'clean', malwareScan: 'clean',
    codeScan: 'clean', phishingScan: 'clean', details: 'Image verified. EXIF metadata stripped for privacy.',
  },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
      background: (STATUS_COLORS[status] ?? '#666') + '18',
      color: STATUS_COLORS[status] ?? '#666',
      border: `1px solid ${(STATUS_COLORS[status] ?? '#666')}33`,
    }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function AdminSecurity() {
  const [scans] = useState<ScanResult[]>(DEMO_SCANS);
  const [expandedScan, setExpandedScan] = useState<string | null>(null);

  const cleanCount = scans.filter(s => s.virusScan === 'clean' && s.malwareScan === 'clean' && s.codeScan === 'clean' && s.phishingScan === 'clean').length;
  const threatCount = scans.filter(s => [s.virusScan, s.malwareScan, s.codeScan, s.phishingScan].some(v => v === 'threat' || v === 'warning')).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Upload Security</h1>
        <p>Every file uploaded to the platform is automatically scanned for viruses, malware, malicious code, and phishing content before it enters storage.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{scans.length}</div>
          <div className="stat-label">Files scanned</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#22c55e33' }}>
          <div className="stat-value" style={{ color: '#22c55e' }}>{cleanCount}</div>
          <div className="stat-label">All clear</div>
        </div>
        <div className="stat-card" style={{ borderColor: threatCount > 0 ? '#ef444433' : undefined }}>
          <div className="stat-value" style={{ color: threatCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>{threatCount}</div>
          <div className="stat-label">Flagged</div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Scan Pipeline</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { title: 'Virus Scan', desc: 'ClamAV signature-based detection', icon: '🛡️' },
            { title: 'Malware Analysis', desc: 'Behavioural and heuristic analysis', icon: '🔬' },
            { title: 'Code Injection Scan', desc: 'Script, macro, and payload detection', icon: '💉' },
            { title: 'Phishing Detection', desc: 'URL and content pattern matching', icon: '🎣' },
          ].map(p => (
            <div key={p.title} style={{
              padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 8,
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border)' }}>
          All files are scanned in an isolated sandbox before being stored. Documents with macros or embedded scripts are automatically stripped. Original files are quarantined for 30 days.
          In production, scans use ClamAV (virus), YARA rules (malware patterns), and custom regex engines (phishing/injection). No file reaches storage without passing all four stages.
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Recent Scans</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{scans.length} files</span>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {scans.map(scan => {
            const expanded = expandedScan === scan.id;
            const hasIssue = [scan.virusScan, scan.malwareScan, scan.codeScan, scan.phishingScan].some(v => v === 'threat' || v === 'warning');
            return (
              <div key={scan.id}>
                <div
                  onClick={() => setExpandedScan(expanded ? null : scan.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto',
                    gap: 8, alignItems: 'center', padding: '10px 12px',
                    background: expanded ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                    borderRadius: expanded ? '6px 6px 0 0' : 6,
                    border: `1px solid ${hasIssue ? '#eab30833' : 'var(--border)'}`,
                    cursor: 'pointer', fontSize: 12, transition: 'background 0.15s',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{scan.fileName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{scan.fileSize} · {scan.uploadedAt}</div>
                  </div>
                  <StatusBadge status={scan.virusScan} />
                  <StatusBadge status={scan.malwareScan} />
                  <StatusBadge status={scan.codeScan} />
                  <StatusBadge status={scan.phishingScan} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
                </div>

                {expanded && (
                  <div style={{
                    padding: 12, background: 'var(--bg-surface)', borderRadius: '0 0 6px 6px',
                    border: `1px solid ${hasIssue ? '#eab30833' : 'var(--border)'}`, borderTop: 'none',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                      {[
                        ['Virus', scan.virusScan],
                        ['Malware', scan.malwareScan],
                        ['Code Injection', scan.codeScan],
                        ['Phishing', scan.phishingScan],
                      ].map(([label, status]) => (
                        <div key={label} style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                          <StatusBadge status={status as string} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 4 }}>
                      {scan.details}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-note">
        In production, file scanning runs on an isolated server. Scan results are stored in the audit log with full provenance. Quarantined files are automatically purged after 30 days unless flagged for investigation.
      </div>
    </div>
  );
}
