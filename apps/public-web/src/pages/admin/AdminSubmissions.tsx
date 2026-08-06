import { useState, useMemo, Fragment } from 'react';
import { useAppStore } from '@/stores/app-store';
import { fetchSubmissions, updateSubmissionStatus, summariseWithAI } from '@/lib/api/submissions';
import { useQuery, useMutation } from '@/lib/hooks/useQuery';
import type { SubmissionSummary } from '../../data/mock-submissions';
import { MODULE_META } from '../../data/mock-incidents';

const formatBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending_review: { bg: '#d69e2e22', color: '#d69e2e', label: 'Pending review' },
  under_review: { bg: '#3182ce22', color: '#3182ce', label: 'Under review' },
  more_info_needed: { bg: '#ed893622', color: '#ed8936', label: 'More info needed' },
  approved: { bg: '#38a16922', color: '#38a169', label: 'Approved' },
  rejected: { bg: '#c5303022', color: '#c53030', label: 'Rejected' },
};

const QUICK_REPLIES = [
  'Thank you for your report. Could you upload higher-quality photos of the scene? Please use the secure link below.',
  'Please share a source link or reference (news article, case number, or official statement) so we can verify this faster.',
  'Could you confirm the exact date, time and nearest town for this incident?',
  'Thank you — your report has been reviewed and approved. It will appear on the map shortly.',
];

export function AdminSubmissions() {
  const { data: rawSubs, loading, error, refetch } = useQuery(fetchSubmissions);
  const statusMutation = useMutation(updateSubmissionStatus);
  const summariseMutation = useMutation(summariseWithAI);

  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});
  const [summaries, setSummaries] = useState<Record<string, SubmissionSummary>>({});
  const [sharePermitted, setSharePermitted] = useState<Record<string, boolean>>({});
  const [staged, setStaged] = useState<Record<string, boolean>>({});

  // Map SubmissionRow[] to the shape the template expects
  const subs = useMemo(() => (rawSubs ?? []).map((row) => {
    const attachmentCount = row.evidence_items?.length ?? 0;
    const attachmentBytes = row.evidence_items?.reduce((s, e) => s + e.file_size_bytes, 0) ?? 0;
    return {
      id: row.id,
      title: row.narrative?.slice(0, 60) ?? row.category?.label_en ?? 'Untitled',
      status: row.status,
      reporter: row.contributor?.display_name ?? 'Anonymous',
      attachments: attachmentCount,
      attachmentBytes,
      oversized: attachmentBytes > 1048576,
      retentionExpiry: attachmentBytes > 1048576
        ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
        : null,
      submitted: row.submitted_at ?? row.created_at,
      town: row.location?.town ?? '',
      province: row.location?.province ?? '',
      dateOccurred: row.occurred_at ?? '',
      knowledgeType: row.knowledge_type,
      narrative: row.narrative ?? '',
      motives: row.reported_motive_statements?.split(', ').filter(Boolean) ?? [],
    };
  }), [rawSubs]);

  // Gating: admins have everything. In production, moderators need the assigned
  // `ai_summarise` / `view_sensitive` permissions — checked server-side.
  const user = useAppStore((s) => s.auth.user);
  const isAdmin = user?.role?.includes('admin') ?? false;

  const openReview = (id: string) => { setOpenId(openId === id ? null : id); setMessage(''); };
  const sendReply = (sub: typeof subs[number]) => { if (message.trim()) setSentTo((p) => ({ ...p, [sub.id]: true })); };
  const runSummary = async (sub: typeof subs[number]) => {
    try {
      const result = await summariseMutation.execute(sub.id);
      setSummaries((p) => ({ ...p, [sub.id]: result }));
    } catch { /* error is surfaced via summariseMutation.error */ }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Submissions</h1>
        <p>Citizen reports awaiting editorial review. Nothing publishes automatically. The AI summary tool drafts a public map entry and keeps sensitive data separate, for admin eyes only.</p>
      </div>

      {loading && <div className="import-msg" style={{ marginBottom: 16 }}>Loading submissions…</div>}
      {error && <div className="import-msg warning" style={{ marginBottom: 16 }}><strong>Error:</strong> {error}</div>}

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-value">{subs.filter((s) => s.status === 'pending_review').length}</div><div className="stat-label">Pending</div></div>
        <div className="stat-card"><div className="stat-value">{subs.filter((s) => s.status === 'under_review').length}</div><div className="stat-label">Under review</div></div>
        <div className="stat-card"><div className="stat-value">{subs.filter((s) => s.status === 'more_info_needed').length}</div><div className="stat-label">Needs info</div></div>
        <div className="stat-card"><div className="stat-value">{subs.filter((s) => s.status === 'approved').length}</div><div className="stat-label">Approved</div></div>
      </div>

      {subs.some((s) => s.oversized) && (
        <div className="import-msg warning" style={{ marginBottom: 16 }}>
          <strong>⚠ Oversized attachments</strong> — {subs.filter((s) => s.oversized).length} submission(s) exceed the 1 MB soft limit. Files are held for 7 days then auto-deleted. Download or request re-upload before expiry.
        </div>
      )}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Title</th><th>Reporter</th><th>Status</th><th>Files</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {subs.map((sub) => {
              const st = STATUS_STYLES[sub.status] ?? STATUS_STYLES.pending_review!;
              const isOpen = openId === sub.id;
              const summary = summaries[sub.id];
              return (
                <Fragment key={sub.id}>
                  <tr>
                    <td><code className="id-code">{sub.id}</code></td>
                    <td className="td-title">{sub.title}</td>
                    <td style={{ fontSize: 12 }}>{sub.reporter}</td>
                    <td><span className="table-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td>{sub.attachments}{sub.oversized && <span className="table-badge" style={{ background: '#d69e2e22', color: '#d69e2e', marginLeft: 4 }}>⚠</span>}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.submitted}</td>
                    <td><button className="btn btn-small" onClick={() => openReview(sub.id)}>{isOpen ? 'Close' : 'Review'}</button></td>
                  </tr>
                  {isOpen && (
                    <tr className="perm-editor-row">
                      <td colSpan={7}>
                        <div className="review-panel">
                          {/* Raw submission */}
                          <div className="review-panel-meta">
                            <div><span>Location</span><strong>{sub.town}, {sub.province}</strong></div>
                            <div><span>Occurred</span><strong>{sub.dateOccurred}</strong></div>
                            <div><span>Knowledge</span><strong>{sub.knowledgeType.replace(/_/g, ' ')}</strong></div>
                            <div><span>Attachments</span><strong>{sub.attachments} file(s) · {formatBytes(sub.attachmentBytes)}</strong></div>
                            {sub.motives.length > 0 && <div><span>Reporter context</span><strong>{sub.motives.map((m) => m.replace(/_/g, ' ')).join(', ')}</strong></div>}
                          </div>
                          {sub.oversized && (
                            <div className="import-msg warning" style={{ margin: '8px 0' }}>
                              <strong>⚠ Oversized attachment ({formatBytes(sub.attachmentBytes)})</strong> — exceeds 1 MB soft limit. Held until <strong>{sub.retentionExpiry}</strong>, then auto-deleted. Download the file or request the reporter re-upload a smaller version before expiry.
                            </div>
                          )}
                          <div className="review-narrative"><span>Submitted text</span><p>{sub.narrative}</p></div>

                          {/* AI summary tool */}
                          <div className="ai-tool">
                            {!summary ? (
                              isAdmin ? (
                                <button className="btn btn-primary btn-small" onClick={() => runSummary(sub)}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: '-2px' }}>
                                    <path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.9z" />
                                  </svg>
                                  AI summarise submission
                                </button>
                              ) : (
                                <div className="ai-locked">The AI summary tool requires the “Use AI summary tool” permission.</div>
                              )
                            ) : (
                              <div className="ai-result">
                                {/* Public, PII-stripped draft */}
                                <div className="ai-block public">
                                  <div className="ai-block-head"><span className="ai-badge safe">Public map draft</span><span className="ai-block-note">PII removed · editor confirms before it reaches the map</span></div>
                                  <div className="ai-fields">
                                    <div><span>Module</span><strong>{MODULE_META[summary.public.module as keyof typeof MODULE_META]?.label ?? summary.public.module}</strong></div>
                                    <div><span>Title</span><strong>{summary.public.title}</strong></div>
                                    <div><span>Location</span><strong>{summary.public.town}, {summary.public.province}</strong></div>
                                    <div><span>Date</span><strong>{summary.public.dateOccurred}</strong></div>
                                    <div><span>Proposed severity</span><strong style={{ textTransform: 'capitalize' }}>{summary.public.severity}</strong></div>
                                  </div>
                                  <div className="ai-summary-text">{summary.public.summary}</div>
                                  <button className="btn btn-small" disabled={staged[sub.id]} onClick={() => setStaged((p) => ({ ...p, [sub.id]: true }))}>
                                    {staged[sub.id] ? '✓ Staged to map queue (awaiting approval)' : 'Stage public draft to map queue'}
                                  </button>
                                </div>

                                {/* Sensitive, admin-only */}
                                <div className="ai-block sensitive">
                                  <div className="ai-block-head"><span className="ai-badge locked">🔒 Sensitive · admin only</span><span className="ai-block-note">Never published. Shared only if you permit it.</span></div>
                                  {isAdmin ? (
                                    <>
                                      <div className="ai-fields">
                                        <div><span>Reporter</span><strong>{[summary.sensitive.reporterFirstName, summary.sensitive.reporterSurname].filter(Boolean).join(' ') || '—'}</strong></div>
                                        <div><span>Email</span><strong>{summary.sensitive.reporterEmail}</strong></div>
                                        <div><span>SAPS / case</span><strong>{summary.sensitive.sapsNumber || '—'}</strong></div>
                                        <div><span>Contacts in text</span><strong>{summary.sensitive.contactsInText.length > 0 ? summary.sensitive.contactsInText.join(', ') : '—'}</strong></div>
                                      </div>
                                      <label className="ai-share-toggle">
                                        <input type="checkbox" checked={!!sharePermitted[sub.id]} onChange={(e) => setSharePermitted((p) => ({ ...p, [sub.id]: e.target.checked }))} />
                                        <span>Permit sharing this sensitive extract with assigned moderators {sharePermitted[sub.id] ? '— sharing allowed' : '— not shared'}</span>
                                      </label>
                                    </>
                                  ) : (
                                    <div className="ai-locked">Hidden. Only admins (or users granted “View / share sensitive data”) can see reporter identity, contacts and case numbers.</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Reply to reporter */}
                          {sentTo[sub.id] ? (
                            <div className="import-msg success" style={{ marginTop: 12 }}>
                              ✓ Reply queued to the reporter with a one-time secure upload link. The sending address is configured server-side and is never exposed here.
                            </div>
                          ) : (
                            <div className="review-reply">
                              <div className="review-quick">
                                <span className="review-quick-label">Quick replies:</span>
                                {QUICK_REPLIES.map((q, i) => <button key={i} className="review-quick-btn" onClick={() => setMessage(q)}>{q.slice(0, 34)}…</button>)}
                              </div>
                              <textarea className="form-input" rows={2} placeholder="Write a short reply to the reporter…" value={message} onChange={(e) => setMessage(e.target.value)} />
                              <div className="review-panel-actions">
                                <button className="btn btn-primary btn-small" disabled={!message.trim()} onClick={() => sendReply(sub)}>Send to reporter</button>
                                <span className="review-panel-hint">Reply-to is the system address (set server-side), not shown here.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="admin-note">
        The summariser runs on a free server-side model (key server-side) under strict PII-separation rules; sensitive data stays in the identity vault and is shared only with users an admin has permitted.
      </div>
    </div>
  );
}
