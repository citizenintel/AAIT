import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULE_META, SEVERITY_META, VERIFICATION_META, type MockIncident, type IncidentEvidence } from '../../data/mock-incidents';
import { fetchIncidents, mockToRow, type IncidentRow } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAppStore } from '@/stores/app-store';
import { deduplicateByContent, incidentFingerprint } from '@/lib/utils/deduplicate';
import { calculateCredibility } from '@/lib/utils/credibility';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

const CASE_STATUSES = [
  'Unresolved', 'Under investigation', 'Arrested', 'In court',
  'Convicted', 'Acquitted', 'Cold case', 'Closed',
];

const EVIDENCE_TYPES: { value: IncidentEvidence['type']; label: string; icon: string }[] = [
  { value: 'article', label: 'News article', icon: '📰' },
  { value: 'police_report', label: 'Police report', icon: '🚔' },
  { value: 'witness', label: 'Witness statement', icon: '👤' },
  { value: 'court_document', label: 'Court document', icon: '⚖️' },
  { value: 'photo', label: 'Photo evidence', icon: '📸' },
  { value: 'video', label: 'Video evidence', icon: '🎥' },
  { value: 'other', label: 'Other', icon: '📎' },
];

const fieldLabelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' };
const fieldInputStyle: React.CSSProperties = { fontSize: 12, padding: '5px 8px', width: '100%' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' };

function rowToMock(row: IncidentRow): MockIncident {
  return {
    id: row.id, title: row.title, summary: row.confirmed_facts ?? '',
    module: (row.category?.module ?? 'ait') as MockIncident['module'],
    category: row.category?.slug ?? '', severity: row.severity as MockIncident['severity'],
    verification: row.verification_state as MockIncident['verification'],
    locationTier: (row.location?.location_tier ?? 'l3_area') as MockIncident['locationTier'],
    lng: row.location?.lng ?? 0, lat: row.location?.lat ?? 0,
    province: row.location?.province ?? '', town: row.location?.town ?? '',
    dateOccurred: row.occurred_at ?? '', dateReported: row.published_at ?? row.created_at,
    sourceCount: typeof row.source_count === 'number' ? row.source_count : 0,
    sources: [], tags: (row.tags ?? []).map(t => t.tag), isSynthetic: row.id.startsWith('syn-'),
    casualties: { deceased: row.fatality_count_confirmed ?? 0, injured: row.injury_count_confirmed ?? 0 },
    courtCase: row.police_case_number ?? undefined,
  };
}

function EvidencePanel({ draft, onUpdate }: { draft: MockIncident; onUpdate: (field: keyof MockIncident, value: unknown) => void }) {
  const [addUrl, setAddUrl] = useState('');
  const [addType, setAddType] = useState<IncidentEvidence['type']>('article');
  const [addTitle, setAddTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const evidence = draft.evidence ?? [];

  const handleSearch = () => {
    const q = [draft.title, draft.town, draft.province, draft.dateOccurred].filter(Boolean).join(' ');
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws`, '_blank');
  };

  const handleQuickAddUrl = () => {
    if (!addUrl.trim()) return;
    let domain = '';
    try { domain = new URL(addUrl.trim()).hostname.replace('www.', ''); } catch { /* skip */ }
    const item: IncidentEvidence = {
      id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      type: 'article',
      title: domain || 'Web source',
      url: addUrl.trim(),
      addedAt: new Date().toISOString(),
    };
    onUpdate('evidence', [...evidence, item]);
    setAddUrl('');
  };

  const handleAddDetailed = () => {
    if (!addTitle.trim()) return;
    const item: IncidentEvidence = {
      id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      type: addType,
      title: addTitle.trim(),
      url: addUrl.trim() || undefined,
      addedAt: new Date().toISOString(),
    };
    onUpdate('evidence', [...evidence, item]);
    setAddTitle(''); setAddUrl(''); setShowAddForm(false);
  };

  const removeEvidence = (evId: string) => {
    onUpdate('evidence', evidence.filter(e => e.id !== evId));
  };

  const cred = calculateCredibility(draft);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={sectionTitleStyle}>Evidence & Sources ({evidence.length})</div>

      {/* Search action */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSearch} className="btn btn-primary" style={{ fontSize: 11, padding: '6px 14px', flex: 'none' }}>
          Search for evidence
        </button>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>
          Opens a news search for this incident
        </div>
      </div>

      {/* Quick-add URL */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Add source URL</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="form-input"
            value={addUrl}
            onChange={e => setAddUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickAddUrl()}
            placeholder="Paste URL here..."
            style={{ fontSize: 12, padding: '5px 8px', flex: 1 }}
          />
          <button onClick={handleQuickAddUrl} disabled={!addUrl.trim()} className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap' }}>
            Add
          </button>
        </div>
      </div>

      {/* Detailed add form */}
      {!showAddForm ? (
        <button onClick={() => setShowAddForm(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, padding: 0, textAlign: 'left' }}>
          + Add other evidence (police report, witness, court doc...)
        </button>
      ) : (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={fieldLabelStyle}>Type</div>
              <select className="form-input" value={addType} onChange={e => setAddType(e.target.value as IncidentEvidence['type'])} style={{ fontSize: 12, marginTop: 2 }}>
                {EVIDENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={fieldLabelStyle}>Description</div>
              <input className="form-input" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Title or description" style={{ fontSize: 12, marginTop: 2 }} />
            </div>
          </div>
          <div>
            <div style={fieldLabelStyle}>URL (optional)</div>
            <input className="form-input" value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://..." style={{ fontSize: 12, marginTop: 2 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowAddForm(false); setAddTitle(''); setAddUrl(''); }} className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>Cancel</button>
            <button onClick={handleAddDetailed} disabled={!addTitle.trim()} className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>Add</button>
          </div>
        </div>
      )}

      {/* Evidence list */}
      {evidence.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {evidence.map(ev => {
            const typeInfo = EVIDENCE_TYPES.find(t => t.value === ev.type);
            return (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 5, border: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{typeInfo?.icon ?? '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {ev.url ? (
                    <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>{ev.title}</a>
                  ) : (
                    <span style={{ fontWeight: 500 }}>{ev.title}</span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{typeInfo?.label}</span>
                </div>
                <button onClick={() => removeEvidence(ev.id)} style={{ background: 'none', border: 'none', color: '#c53030', cursor: 'pointer', fontSize: 12, padding: '2px 4px', flexShrink: 0, lineHeight: 1 }} title="Remove">✕</button>
              </div>
            );
          })}
        </div>
      )}

      {evidence.length === 0 && (
        <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, background: 'var(--bg-elevated)', borderRadius: 5, border: '1px dashed var(--border)' }}>
          No evidence yet — search for articles or add URLs to build the case file
        </div>
      )}

      {/* Credibility */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" width={36} height={36}>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border)" strokeWidth="3.5" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={cred.colour} strokeWidth="3.5" strokeDasharray={`${cred.score}, 100`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: cred.colour }}>{cred.score}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: cred.colour }}>{cred.level}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {cred.score >= 60 ? 'Well-documented' : cred.score >= 30 ? 'Add evidence to strengthen' : 'Needs verification'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandedRow({ incidentRow, onCollapse }: { incidentRow: IncidentRow; onCollapse: () => void }) {
  const navigate = useNavigate();
  const importedIncidents = useAppStore((s) => s.importedIncidents);
  const updateImportedIncident = useAppStore((s) => s.updateImportedIncident);
  const deleteImportedIncident = useAppStore((s) => s.deleteImportedIncident);
  const addImportedIncidents = useAppStore((s) => s.addImportedIncidents);

  const isImported = importedIncidents.some(i => i.id === incidentRow.id);
  const baseMock = useMemo(() => {
    if (isImported) return importedIncidents.find(i => i.id === incidentRow.id)!;
    return rowToMock(incidentRow);
  }, [incidentRow, isImported, importedIncidents]);

  const [draft, setDraft] = useState<Partial<MockIncident>>({});
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const current = useMemo(() => ({ ...baseMock, ...draft } as MockIncident), [baseMock, draft]);
  const hasDraft = Object.keys(draft).length > 0;

  const updateField = useCallback((field: keyof MockIncident, value: unknown) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    if (Object.keys(draft).length === 0) return;
    if (isImported) {
      updateImportedIncident(incidentRow.id, draft);
    } else {
      addImportedIncidents([{ ...baseMock, ...draft }]);
    }
    setDraft({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [draft, isImported, incidentRow.id, baseMock, updateImportedIncident, addImportedIncidents]);

  const handleDelete = useCallback(() => {
    deleteImportedIncident(incidentRow.id);
    onCollapse();
  }, [incidentRow.id, deleteImportedIncident, onCollapse]);

  return (
    <tr>
      <td colSpan={8} style={{ padding: 0, borderTop: 'none' }}>
        <div style={{ padding: '16px 20px', background: 'var(--surface-0)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
            {/* Left: Case Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={sectionTitleStyle}>Case Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={fieldLabelStyle}>Title</div>
                  <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.title} onChange={e => updateField('title', e.target.value)} />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Victim name</div>
                  <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.victimName ?? ''} onChange={e => updateField('victimName', e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Date occurred</div>
                  <input className="form-input" type="date" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.dateOccurred ?? ''} onChange={e => updateField('dateOccurred', e.target.value)} />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Location / town</div>
                  <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.town ?? ''} onChange={e => updateField('town', e.target.value)} placeholder="Town name" />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Province</div>
                  <select className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.province ?? ''} onChange={e => updateField('province', e.target.value)}>
                    <option value="">-- Select --</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={fieldLabelStyle}>Incident type</div>
                  <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.incidentType ?? ''} onChange={e => updateField('incidentType', e.target.value)} placeholder="e.g. Farm attack, robbery" />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Module</div>
                  <select className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.module} onChange={e => updateField('module', e.target.value)}>
                    {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={fieldLabelStyle}>Severity</div>
                  <select className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.severity} onChange={e => updateField('severity', e.target.value)}>
                    {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={fieldLabelStyle}>Verification</div>
                  <select className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.verification} onChange={e => updateField('verification', e.target.value)}>
                    {Object.entries(VERIFICATION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={fieldLabelStyle}>Deceased</div>
                  <input className="form-input" type="number" min={0} style={{ ...fieldInputStyle, marginTop: 2, maxWidth: 80 }} value={current.casualties?.deceased ?? 0}
                    onChange={e => updateField('casualties', { deceased: parseInt(e.target.value) || 0, injured: current.casualties?.injured ?? 0 })} />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Injured</div>
                  <input className="form-input" type="number" min={0} style={{ ...fieldInputStyle, marginTop: 2, maxWidth: 80 }} value={current.casualties?.injured ?? 0}
                    onChange={e => updateField('casualties', { deceased: current.casualties?.deceased ?? 0, injured: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <div style={fieldLabelStyle}>Case status</div>
                  <select className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.caseStatus ?? ''} onChange={e => updateField('caseStatus', e.target.value)}>
                    <option value="">-- Select --</option>
                    {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={fieldLabelStyle}>Verdict / outcome</div>
                  <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.verdict ?? ''} onChange={e => updateField('verdict', e.target.value)} placeholder="Court outcome" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={fieldLabelStyle}>Source URL</div>
                  <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.sourceUrl ?? ''} onChange={e => updateField('sourceUrl', e.target.value)} placeholder="https://..." />
                </div>
              </div>

              {/* Confidential fields */}
              <div>
                <div style={{ ...sectionTitleStyle, color: '#d97706' }}>Confidential — stored locally only</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={fieldLabelStyle}>Suspect name</div>
                    <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.suspectName ?? ''} onChange={e => updateField('suspectName', e.target.value)} placeholder="If known" />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Court case / docket</div>
                    <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.courtCase ?? ''} onChange={e => updateField('courtCase', e.target.value)} placeholder="CAS number, docket ref" />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Reporter / contact</div>
                    <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.reporter ?? ''} onChange={e => updateField('reporter', e.target.value)} placeholder="Who reported" />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Phone number</div>
                    <input className="form-input" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.contactPhone ?? ''} onChange={e => updateField('contactPhone', e.target.value)} placeholder="Contact number" />
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Email address</div>
                    <input className="form-input" type="email" style={{ ...fieldInputStyle, marginTop: 2 }} value={current.contactEmail ?? ''} onChange={e => updateField('contactEmail', e.target.value)} placeholder="Contact email" />
                  </div>
                </div>
              </div>

              {/* Case Notes */}
              <div>
                <div style={sectionTitleStyle}>Case Notes</div>
                <textarea
                  className="form-input"
                  value={current.summary ?? ''}
                  onChange={e => updateField('summary', e.target.value)}
                  placeholder="Full case description, witness accounts, timeline..."
                  style={{ fontSize: 12, lineHeight: 1.6, minHeight: 80, resize: 'vertical', width: '100%', whiteSpace: 'pre-wrap' }}
                />
              </div>

              {/* Tags */}
              {current.tags.length > 0 && (
                <div>
                  <div style={sectionTitleStyle}>Tags</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {current.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Evidence & Credibility */}
            <div>
              <EvidencePanel draft={current} onUpdate={updateField} />
            </div>
          </div>

          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => navigate(`/admin/incidents/${incidentRow.id}`)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, padding: 0 }}>
                Open full profile →
              </button>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {incidentRow.id}</span>
              {current.lat !== 0 && current.lng !== 0 && (
                <>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{current.lat.toFixed(4)}, {current.lng.toFixed(4)}</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saved && <span style={{ fontSize: 11, color: '#38a169', fontWeight: 600 }}>Saved</span>}
              {hasDraft && <span style={{ fontSize: 11, color: '#d97706' }}>Unsaved</span>}
              {isImported && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, background: 'none', color: '#c53030', border: '1px solid #c53030', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
              )}
              {confirmDelete && (
                <>
                  <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)} style={{ fontSize: 11, padding: '5px 10px' }}>Cancel</button>
                  <button onClick={handleDelete} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, background: '#c53030', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Confirm delete</button>
                </>
              )}
              <button className="btn btn-primary" onClick={save} disabled={!hasDraft} style={{ fontSize: 11, padding: '5px 14px' }}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function AddIncidentForm({ onAdd, onCancel }: { onAdd: (inc: MockIncident) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [victimName, setVictimName] = useState('');
  const [dateOccurred, setDateOccurred] = useState('');
  const [town, setTown] = useState('');
  const [province, setProvince] = useState('');
  const [module, setModule] = useState('ait');
  const [severity, setSeverity] = useState('high');
  const [summary, setSummary] = useState('');

  const handleAdd = () => {
    const finalTitle = title.trim() || (victimName ? `${victimName} — ${town || province || 'Unknown'}` : 'Untitled incident');
    const inc: MockIncident = {
      id: `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: finalTitle,
      summary: summary.trim(),
      module: module as MockIncident['module'],
      category: module,
      severity: severity as MockIncident['severity'],
      verification: 'v0_unverified' as MockIncident['verification'],
      locationTier: 'l3_area' as MockIncident['locationTier'],
      lng: 0, lat: 0,
      province, town,
      dateOccurred: dateOccurred || new Date().toISOString().slice(0, 10),
      dateReported: new Date().toISOString().slice(0, 10),
      sourceCount: 0, sources: [], tags: [],
      isSynthetic: false,
      victimName: victimName || undefined,
    };
    onAdd(inc);
  };

  return (
    <div className="admin-card" style={{ borderLeft: '3px solid #3b82f6' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add New Incident</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <div style={fieldLabelStyle}>Victim name</div>
          <input className="form-input" value={victimName} onChange={e => setVictimName(e.target.value)} placeholder="Full name" style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <div style={fieldLabelStyle}>Title (auto-generated if blank)</div>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Incident title" style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <div style={fieldLabelStyle}>Date occurred</div>
          <input className="form-input" type="date" value={dateOccurred} onChange={e => setDateOccurred(e.target.value)} style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <div style={fieldLabelStyle}>Location / town</div>
          <input className="form-input" value={town} onChange={e => setTown(e.target.value)} placeholder="Town name" style={{ fontSize: 12, marginTop: 2 }} />
        </div>
        <div>
          <div style={fieldLabelStyle}>Province</div>
          <select className="form-input" value={province} onChange={e => setProvince(e.target.value)} style={{ fontSize: 12, marginTop: 2 }}>
            <option value="">-- Select --</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>Module</div>
          <select className="form-input" value={module} onChange={e => setModule(e.target.value)} style={{ fontSize: 12, marginTop: 2 }}>
            {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>Severity</div>
          <select className="form-input" value={severity} onChange={e => setSeverity(e.target.value)} style={{ fontSize: 12, marginTop: 2 }}>
            {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <div style={fieldLabelStyle}>Summary / notes</div>
          <textarea className="form-input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Case description..." rows={2} style={{ fontSize: 12, marginTop: 2, resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>
        <button className="btn btn-primary" onClick={handleAdd} style={{ fontSize: 12 }}>Add incident</button>
      </div>
    </div>
  );
}

export function AdminIncidents() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: apiIncidents } = useQuery(() => fetchIncidents(), []);
  const importedIncidents = useAppStore((s) => s.importedIncidents);
  const addImportedIncidents = useAppStore((s) => s.addImportedIncidents);

  const incidents = useMemo(() => {
    const api = apiIncidents ?? [];
    const imported = importedIncidents.map(mockToRow);
    return deduplicateByContent(
      [...api, ...imported],
      (i: IncidentRow) => incidentFingerprint(i.title, i.occurred_at ?? '', i.location?.town ?? i.location?.province ?? ''),
      (i: IncidentRow) => i.id,
    );
  }, [apiIncidents, importedIncidents]);

  const credibilityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const imp of importedIncidents) {
      map.set(imp.id, calculateCredibility(imp).score);
    }
    return map;
  }, [importedIncidents]);

  const filtered = useMemo(() => {
    return incidents.filter(inc => {
      if (moduleFilter !== 'all' && inc.category?.module !== moduleFilter) return false;
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !inc.title.toLowerCase().includes(q) &&
          !(inc.location?.town ?? '').toLowerCase().includes(q) &&
          !(inc.location?.province ?? '').toLowerCase().includes(q) &&
          !(inc.confirmed_facts ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [search, moduleFilter, severityFilter, incidents]);

  const handleAddIncident = useCallback((inc: MockIncident) => {
    addImportedIncidents([inc]);
    setShowAdd(false);
    setExpandedId(inc.id);
  }, [addImportedIncidents]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Incidents</h1>
            <p>{filtered.length} of {incidents.length} incidents — click any row to expand full details and research links</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 12 }}>
            + Add Incident
          </button>
        </div>
      </div>

      {showAdd && <AddIncidentForm onAdd={handleAddIncident} onCancel={() => setShowAdd(false)} />}

      <div className="admin-toolbar">
        <input type="text" className="form-input" placeholder="Search title, location, or case notes..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 340 }} />
        <select className="form-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All modules</option>
          {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All severities</option>
          {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        <table className="admin-table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <th>Title</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Location</th>
              <th>Date</th>
              <th>Casualties</th>
              <th>Credibility</th>
            </tr>
          </thead>
          {filtered.map(inc => {
              const isExpanded = expandedId === inc.id;
              const mod = MODULE_META[inc.category?.module as keyof typeof MODULE_META];
              const sev = SEVERITY_META[inc.severity as keyof typeof SEVERITY_META];
              const dead = inc.fatality_count_confirmed ?? 0;
              const hurt = inc.injury_count_confirmed ?? 0;
              const cred = credibilityMap.get(inc.id);
              const credColour = cred !== undefined ? (cred >= 60 ? '#48bb78' : cred >= 30 ? '#ecc94b' : '#a0aec0') : undefined;

              return (
                <tbody key={inc.id}>
                  <tr onClick={() => toggleExpand(inc.id)} style={{ cursor: 'pointer', background: isExpanded ? 'var(--surface-0)' : undefined }}>
                    <td style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', padding: '8px 4px' }}>
                      {isExpanded ? '▼' : '▶'}
                    </td>
                    <td className="td-title" style={{ fontWeight: 500 }}>{inc.title}</td>
                    <td><span style={{ color: mod?.colour, fontWeight: 500, fontSize: 11 }}>{mod?.label}</span></td>
                    <td><span className="table-badge" style={{ background: (sev?.colour ?? '#888') + '22', color: sev?.colour }}>{sev?.label}</span></td>
                    <td style={{ fontSize: 11 }}>{inc.location?.town}{inc.location?.town && inc.location?.province ? ', ' : ''}{inc.location?.province}</td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{inc.occurred_at}</td>
                    <td style={{ textAlign: 'center', fontSize: 11 }}>
                      {dead > 0 && <span style={{ color: '#c53030', fontWeight: 700 }}>{dead}D</span>}
                      {dead > 0 && hurt > 0 && ' '}
                      {hurt > 0 && <span style={{ color: '#ed8936', fontWeight: 700 }}>{hurt}I</span>}
                      {dead === 0 && hurt === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {cred !== undefined ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: credColour }}>{cred}%</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && <ExpandedRow incidentRow={inc} onCollapse={() => setExpandedId(null)} />}
                </tbody>
              );
            })}
        </table>
      </div>
    </div>
  );
}
