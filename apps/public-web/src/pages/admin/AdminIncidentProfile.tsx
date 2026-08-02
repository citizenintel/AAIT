import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MODULE_META, SEVERITY_META, VERIFICATION_META, type MockIncident, type IncidentEvidence } from '../../data/mock-incidents';
import { fetchIncidents, type IncidentRow } from '@/lib/api/incidents';
import { useQuery } from '@/lib/hooks/useQuery';
import { useAppStore } from '@/stores/app-store';
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

const sectionTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' };
const fieldInputStyle: React.CSSProperties = { fontSize: 12, padding: '4px 8px', width: '100%' };

function FieldRow({ label, children, confidential }: { label: string; children: React.ReactNode; confidential?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center', minHeight: 36 }}>
      <label style={{ fontSize: 11, color: confidential ? '#d97706' : 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function CredibilityMeter({ incident }: { incident: MockIncident }) {
  const { score, level, colour, breakdown } = calculateCredibility(incident);
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>Credibility Score</span>
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <svg viewBox="0 0 36 36" width={64} height={64}>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border)" strokeWidth="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={colour} strokeWidth="3" strokeDasharray={`${score}, 100`} strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: colour }}>{score}</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colour }}>{level}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {score >= 60 ? 'Well-documented case' : score >= 30 ? 'Add evidence to strengthen' : 'Needs verification'}
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {breakdown.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 30px', gap: 8, alignItems: 'center', fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>{b.label}</span>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-0)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.max > 0 ? (b.points / b.max) * 100 : 0}%`, background: b.points > 0 ? colour : 'transparent', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <span style={{ textAlign: 'right', color: b.points > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: b.points > 0 ? 600 : 400 }}>{b.points}/{b.max}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceManager({ incident, onUpdate }: { incident: MockIncident; onUpdate: (evidence: IncidentEvidence[]) => void }) {
  const [addUrl, setAddUrl] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<IncidentEvidence['type']>('article');
  const [addTitle, setAddTitle] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const evidence = incident.evidence ?? [];

  const handleSearch = () => {
    const q = [incident.title, incident.town, incident.province, incident.dateOccurred].filter(Boolean).join(' ');
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
    onUpdate([...evidence, item]);
    setAddUrl('');
  };

  const handleAddDetailed = () => {
    if (!addTitle.trim()) return;
    const item: IncidentEvidence = {
      id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      type: addType,
      title: addTitle.trim(),
      url: addUrl.trim() || undefined,
      notes: addNotes.trim() || undefined,
      addedAt: new Date().toISOString(),
    };
    onUpdate([...evidence, item]);
    setAddTitle(''); setAddUrl(''); setAddNotes(''); setShowAddForm(false);
  };

  const removeEvidence = (id: string) => onUpdate(evidence.filter(e => e.id !== id));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={sectionTitleStyle}>Evidence & Sources ({evidence.length})</div>
      </div>

      {/* Search + Quick-add */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <button onClick={handleSearch} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 16px', alignSelf: 'flex-start' }}>
          Search for evidence
        </button>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>Add source URL</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" value={addUrl} onChange={e => setAddUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQuickAddUrl()} placeholder="Paste URL here..." style={{ fontSize: 12, flex: 1 }} />
            <button onClick={handleQuickAddUrl} disabled={!addUrl.trim()} className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 12px' }}>Add</button>
          </div>
        </div>
        {!showAddForm ? (
          <button onClick={() => setShowAddForm(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, padding: 0, textAlign: 'left' }}>
            + Add other evidence (police report, witness, court doc...)
          </button>
        ) : (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Type</label>
                <select className="form-input" value={addType} onChange={e => setAddType(e.target.value as IncidentEvidence['type'])} style={{ fontSize: 12, marginTop: 2 }}>
                  {EVIDENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Title / description</label>
                <input className="form-input" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Description" style={{ fontSize: 12, marginTop: 2 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>URL (optional)</label>
              <input className="form-input" value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://..." style={{ fontSize: 12, marginTop: 2 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Notes (optional)</label>
              <input className="form-input" value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Relevance, key quotes, etc." style={{ fontSize: 12, marginTop: 2 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setAddTitle(''); setAddUrl(''); setAddNotes(''); }} style={{ fontSize: 11 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDetailed} disabled={!addTitle.trim()} style={{ fontSize: 11 }}>Add</button>
            </div>
          </div>
        )}
      </div>

      {/* Evidence list */}
      {evidence.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {evidence.map(ev => {
            const typeInfo = EVIDENCE_TYPES.find(t => t.value === ev.type);
            return (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{typeInfo?.icon ?? '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ev.url ? <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>{ev.title}</a> : ev.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {typeInfo?.label} · Added {new Date(ev.addedAt).toLocaleDateString('en-ZA')}
                  </div>
                  {ev.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{ev.notes}</div>}
                </div>
                <button onClick={() => removeEvidence(ev.id)} style={{ background: 'none', border: 'none', color: '#c53030', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }} title="Remove">✕</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px dashed var(--border)' }}>
          No evidence yet — search for articles or add URLs to build the case file
        </div>
      )}
    </div>
  );
}

export function AdminIncidentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: apiIncidents } = useQuery(() => fetchIncidents(), []);
  const importedIncidents = useAppStore((s) => s.importedIncidents);
  const updateImportedIncident = useAppStore((s) => s.updateImportedIncident);
  const deleteImportedIncident = useAppStore((s) => s.deleteImportedIncident);
  const addImportedIncidents = useAppStore((s) => s.addImportedIncidents);

  const incident = useMemo(() => {
    const imp = importedIncidents.find(i => i.id === id);
    if (imp) return imp;
    const api = apiIncidents ?? [];
    for (const row of api) {
      if (row.id === id) {
        const m: MockIncident = {
          id: row.id, title: row.title, summary: row.confirmed_facts ?? '',
          module: (row.category?.module ?? 'ait') as MockIncident['module'],
          category: row.category?.slug ?? '', severity: row.severity as MockIncident['severity'],
          verification: row.verification_state as MockIncident['verification'],
          locationTier: (row.location?.location_tier ?? 'l3_area') as MockIncident['locationTier'],
          lng: row.location?.lng ?? 0, lat: row.location?.lat ?? 0,
          province: row.location?.province ?? '', town: row.location?.town ?? '',
          dateOccurred: row.occurred_at ?? '', dateReported: row.published_at ?? row.created_at,
          sourceCount: typeof row.source_count === 'number' ? row.source_count : 0,
          sources: [], tags: (row.tags ?? []).map(t => t.tag), isSynthetic: true,
          casualties: { deceased: row.fatality_count_confirmed ?? 0, injured: row.injury_count_confirmed ?? 0 },
          courtCase: row.police_case_number ?? undefined,
        };
        return m;
      }
    }
    return null;
  }, [id, importedIncidents, apiIncidents]);

  const isImported = useMemo(() => importedIncidents.some(i => i.id === id), [importedIncidents, id]);

  const [draft, setDraft] = useState<Partial<MockIncident>>({});
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const current = useMemo(() => incident ? { ...incident, ...draft } as MockIncident : null, [incident, draft]);

  const updateField = useCallback((field: keyof MockIncident, value: unknown) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    if (!id || Object.keys(draft).length === 0) return;
    if (isImported) {
      updateImportedIncident(id, draft);
    } else {
      const full = { ...incident!, ...draft };
      addImportedIncidents([full]);
    }
    setDraft({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [id, draft, isImported, incident, updateImportedIncident, addImportedIncidents]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    deleteImportedIncident(id);
    navigate('/admin/incidents');
  }, [id, deleteImportedIncident, navigate]);

  if (!current) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1>Incident not found</h1>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/incidents')}>Back to incidents</button>
        </div>
      </div>
    );
  }

  const mod = MODULE_META[current.module as keyof typeof MODULE_META];
  const sev = SEVERITY_META[current.severity as keyof typeof SEVERITY_META];
  const ver = VERIFICATION_META[current.verification];
  const hasDraft = Object.keys(draft).length > 0;

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <button onClick={() => navigate('/admin/incidents')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, marginBottom: 6, padding: 0 }}>
            ← Back to Incidents
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>{current.title}</h1>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: (mod?.colour ?? '#888') + '22', color: mod?.colour, fontWeight: 600 }}>{mod?.label}</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: (sev?.colour ?? '#888') + '22', color: sev?.colour, fontWeight: 600 }}>{sev?.label}</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: ver?.ring ?? '1px solid var(--border)', fontWeight: 600 }}>{ver?.label ?? current.verification}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {current.town && `${current.town}, `}{current.province} · {current.dateOccurred || 'Date unknown'} · ID: {current.id}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 11, color: '#38a169', fontWeight: 600 }}>Saved</span>}
          {hasDraft && <span style={{ fontSize: 11, color: '#d97706' }}>Unsaved changes</span>}
          <button className="btn btn-primary" onClick={save} disabled={!hasDraft} style={{ fontSize: 12 }}>Save changes</button>
          {isImported && (
            confirmDelete
              ? <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)} style={{ fontSize: 11 }}>Cancel</button>
                  <button onClick={handleDelete} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 4, background: '#c53030', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Confirm delete</button>
                </div>
              : <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 4, background: 'none', color: '#c53030', border: '1px solid #c53030', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Left column: main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Case Details */}
          <div className="admin-card">
            <div style={sectionTitleStyle}>Case Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <FieldRow label="Title">
                <input className="form-input" style={fieldInputStyle} value={current.title} onChange={e => updateField('title', e.target.value)} />
              </FieldRow>
              <FieldRow label="Victim name">
                <input className="form-input" style={fieldInputStyle} value={current.victimName ?? ''} onChange={e => updateField('victimName', e.target.value)} placeholder="Full name of victim" />
              </FieldRow>
              <FieldRow label="Date occurred">
                <input className="form-input" type="date" style={fieldInputStyle} value={current.dateOccurred ?? ''} onChange={e => updateField('dateOccurred', e.target.value)} />
              </FieldRow>
              <FieldRow label="Location / town">
                <input className="form-input" style={fieldInputStyle} value={current.town ?? ''} onChange={e => updateField('town', e.target.value)} placeholder="Town or area name" />
              </FieldRow>
              <FieldRow label="Province">
                <select className="form-input" style={fieldInputStyle} value={current.province ?? ''} onChange={e => updateField('province', e.target.value)}>
                  <option value="">-- Select province --</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Incident type">
                <input className="form-input" style={fieldInputStyle} value={current.incidentType ?? ''} onChange={e => updateField('incidentType', e.target.value)} placeholder="e.g. Farm attack, robbery, murder" />
              </FieldRow>
              <FieldRow label="Module">
                <select className="form-input" style={fieldInputStyle} value={current.module} onChange={e => updateField('module', e.target.value)}>
                  {Object.entries(MODULE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Severity">
                <select className="form-input" style={fieldInputStyle} value={current.severity} onChange={e => updateField('severity', e.target.value)}>
                  {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Verification">
                <select className="form-input" style={fieldInputStyle} value={current.verification} onChange={e => updateField('verification', e.target.value)}>
                  {Object.entries(VERIFICATION_META).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.description}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Deceased">
                <input className="form-input" type="number" min={0} style={{ ...fieldInputStyle, maxWidth: 80 }} value={current.casualties?.deceased ?? 0}
                  onChange={e => updateField('casualties', { deceased: parseInt(e.target.value) || 0, injured: current.casualties?.injured ?? 0 })} />
              </FieldRow>
              <FieldRow label="Injured">
                <input className="form-input" type="number" min={0} style={{ ...fieldInputStyle, maxWidth: 80 }} value={current.casualties?.injured ?? 0}
                  onChange={e => updateField('casualties', { deceased: current.casualties?.deceased ?? 0, injured: parseInt(e.target.value) || 0 })} />
              </FieldRow>
              <FieldRow label="Case status">
                <select className="form-input" style={fieldInputStyle} value={current.caseStatus ?? ''} onChange={e => updateField('caseStatus', e.target.value)}>
                  <option value="">-- Select --</option>
                  {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Verdict / outcome">
                <input className="form-input" style={fieldInputStyle} value={current.verdict ?? ''} onChange={e => updateField('verdict', e.target.value)} placeholder="Court outcome or final verdict" />
              </FieldRow>
              <FieldRow label="Source URL">
                <input className="form-input" style={fieldInputStyle} value={current.sourceUrl ?? ''} onChange={e => updateField('sourceUrl', e.target.value)} placeholder="https://..." />
              </FieldRow>
            </div>
          </div>

          {/* Confidential Fields */}
          <div className="admin-card">
            <div style={{ ...sectionTitleStyle, color: '#d97706' }}>Confidential — stored locally only</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <FieldRow label="Suspect name" confidential>
                <input className="form-input" style={fieldInputStyle} value={current.suspectName ?? ''} onChange={e => updateField('suspectName', e.target.value)} placeholder="Name of suspect (if known)" />
              </FieldRow>
              <FieldRow label="Court case / docket" confidential>
                <input className="form-input" style={fieldInputStyle} value={current.courtCase ?? ''} onChange={e => updateField('courtCase', e.target.value)} placeholder="CAS number, court docket, SAPS ref" />
              </FieldRow>
              <FieldRow label="Reporter / contact" confidential>
                <input className="form-input" style={fieldInputStyle} value={current.reporter ?? ''} onChange={e => updateField('reporter', e.target.value)} placeholder="Name of person who reported" />
              </FieldRow>
              <FieldRow label="Phone number" confidential>
                <input className="form-input" style={fieldInputStyle} value={current.contactPhone ?? ''} onChange={e => updateField('contactPhone', e.target.value)} placeholder="Contact number" />
              </FieldRow>
              <FieldRow label="Email address" confidential>
                <input className="form-input" type="email" style={fieldInputStyle} value={current.contactEmail ?? ''} onChange={e => updateField('contactEmail', e.target.value)} placeholder="Contact email" />
              </FieldRow>
            </div>
          </div>

          {/* Case Notes */}
          <div className="admin-card">
            <div style={sectionTitleStyle}>Case Notes</div>
            <textarea
              className="form-input"
              value={current.summary ?? ''}
              onChange={e => updateField('summary', e.target.value)}
              placeholder="Full case description, witness accounts, evidence details..."
              style={{ fontSize: 12, lineHeight: 1.6, minHeight: 180, resize: 'vertical', width: '100%', whiteSpace: 'pre-wrap' }}
            />
          </div>

          {/* Evidence */}
          <div className="admin-card">
            <EvidenceManager incident={current} onUpdate={(evidence) => updateField('evidence', evidence)} />
          </div>
        </div>

        {/* Right column: credibility + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 20 }}>
          <CredibilityMeter incident={current} />

          {/* Quick stats */}
          <div className="admin-card">
            <div style={sectionTitleStyle}>Quick Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(current.casualties?.deceased ?? 0) > 0 && (
                <div style={{ background: '#c5303011', borderRadius: 6, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#c53030' }}>{current.casualties!.deceased}</div>
                  <div style={{ fontSize: 10, color: '#c53030' }}>Deceased</div>
                </div>
              )}
              {(current.casualties?.injured ?? 0) > 0 && (
                <div style={{ background: '#ed893611', borderRadius: 6, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#ed8936' }}>{current.casualties!.injured}</div>
                  <div style={{ fontSize: 10, color: '#ed8936' }}>Injured</div>
                </div>
              )}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: 10, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{current.evidence?.length ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Evidence</div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: 10, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{current.sourceCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sources</div>
              </div>
            </div>
          </div>

          {/* Coordinates */}
          {current.lat !== 0 && current.lng !== 0 && (
            <div className="admin-card">
              <div style={sectionTitleStyle}>Coordinates</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {current.lat.toFixed(4)}, {current.lng.toFixed(4)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
