import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Footer } from '../components/Footer';
import { MODULE_META } from '../data/mock-incidents';

const SOFT_LIMIT_BYTES = 1024 * 1024; // 1 MB — files above this are held for 7 days then purged
const formatBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`);
const MAX_NOTE_WORDS = 300;
const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const ACCEPTED_FILES = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.odt,.ods';

const MOTIVE_OPTIONS = [
  { value: 'robbery_theft', label: 'Robbery / theft' },
  { value: 'home_invasion', label: 'Home invasion' },
  { value: 'hijacking', label: 'Hijacking / carjacking' },
  { value: 'livestock_theft', label: 'Livestock theft' },
  { value: 'assault', label: 'Assault' },
  { value: 'murder', label: 'Murder / attempted murder' },
  { value: 'sexual_violence', label: 'Sexual violence' },
  { value: 'kidnapping', label: 'Kidnapping / abduction' },
  { value: 'arson', label: 'Arson / property damage' },
  { value: 'political', label: 'Political / protest-related' },
  { value: 'service_delivery', label: 'Service delivery dispute' },
  { value: 'land_dispute', label: 'Land / property dispute' },
  { value: 'hate_crime', label: 'Hate crime (as perceived by reporter)' },
  { value: 'domestic', label: 'Domestic / interpersonal' },
  { value: 'gang_related', label: 'Gang-related' },
  { value: 'xenophobic', label: 'Xenophobic violence' },
  { value: 'unknown', label: 'Unknown / unclear' },
] as const;

type Step = 'type' | 'details' | 'location' | 'sources' | 'review';
const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'details', label: 'Details' },
  { key: 'location', label: 'Location' },
  { key: 'sources', label: 'Sources' },
  { key: 'review', label: 'Review' },
];

export function ReportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('type');
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [oversized, setOversized] = useState(false);
  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setFileError('');
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    const total = next.reduce((s, f) => s + f.size, 0);
    if (total > SOFT_LIMIT_BYTES) {
      setOversized(true);
    } else {
      setOversized(false);
    }
    setFiles(next);
  };
  const removeFile = (name: string, size: number) => setFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  const [form, setForm] = useState({
    module: '' as string,
    category: '',
    title: '',
    description: '',
    dateOccurred: '',
    province: '',
    town: '',
    knowledgeType: '' as string,
    sourceName: '',
    sourceUrl: '',
    notes: '',
    motives: [] as string[],
    declaration: false,
  });

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const canProceed = (): boolean => {
    switch (step) {
      case 'type': return !!form.module && !!form.knowledgeType;
      case 'details': return !!form.title && !!form.description && !!form.dateOccurred;
      case 'location': return !!form.province;
      case 'sources': return true;
      case 'review': return form.declaration;
    }
  };

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!.key);
  };
  const goBack = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1]!.key);
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="app-shell" style={{ gridTemplateColumns: '1fr' }}>
        <TopBar />
        <div className="page-content">
          <div className="page-container" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 80 }}>
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <h1>Report submitted</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
              Your report has been received and will be reviewed by our editorial team.
              Citizen reports never publish automatically — an editor must verify and approve before publication.
            </p>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 13 }}>
              Reference: SUB-{Date.now().toString(36).toUpperCase()}
            </p>
            <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/')}>Back to map</button>
              <button className="btn btn-secondary" onClick={() => { setSubmitted(false); setStep('type'); setForm({ ...form, declaration: false }); }}>Submit another</button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar />
      <div className="page-content">
        <div className="page-container" style={{ maxWidth: 700 }}>
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to map
          </button>

          <h1 style={{ marginBottom: 8 }}>Report an incident</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 13 }}>
            Your report will be reviewed by our editorial team before publication. Nothing publishes automatically.
          </p>

          {/* Progress bar */}
          <div className="wizard-progress">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`wizard-step${i <= stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}>
                <div className="wizard-step-dot">{i < stepIndex ? '✓' : i + 1}</div>
                <span className="wizard-step-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Step: Type */}
          {step === 'type' && (
            <div className="wizard-panel">
              <h2>What type of incident?</h2>
              <div className="module-select">
                {Object.entries(MODULE_META).map(([key, meta]) => (
                  <button
                    key={key}
                    className={`module-option${form.module === key ? ' selected' : ''}`}
                    onClick={() => setForm({ ...form, module: key })}
                    style={{ '--module-color': meta.colour } as React.CSSProperties}
                  >
                    <span className="module-option-dot" style={{ background: meta.colour }} />
                    <div>
                      <div className="module-option-label">{meta.label}</div>
                      <div className="module-option-desc">{meta.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              <h3 style={{ marginTop: 24 }}>How do you know about this?</h3>
              <div className="radio-group">
                {[
                  { value: 'witness', label: 'I witnessed it' },
                  { value: 'victim', label: 'I am the victim / directly affected' },
                  { value: 'second_hand', label: 'Someone told me / shared it with me' },
                  { value: 'media', label: 'I saw it in the media' },
                  { value: 'official', label: 'I have official/police information' },
                ].map(opt => (
                  <label key={opt.value} className={`radio-option${form.knowledgeType === opt.value ? ' selected' : ''}`}>
                    <input type="radio" name="knowledgeType" value={opt.value} checked={form.knowledgeType === opt.value} onChange={() => setForm({ ...form, knowledgeType: opt.value })} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step: Details */}
          {step === 'details' && (
            <div className="wizard-panel">
              <h2>What happened?</h2>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input type="text" className="form-input" placeholder="Brief title for this incident" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={6} placeholder="Describe what happened. Include details like time of day, number of people involved, any injuries, response from emergency services..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">When did this happen?</label>
                <input type="date" className="form-input" value={form.dateOccurred} onChange={(e) => setForm({ ...form, dateOccurred: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Perceived motive / context (optional)</label>
                <p className="form-hint">Select any that apply, based on your own understanding. This helps our analysts but is never published. You can also describe context in your own words in the description above.</p>
                <div className="motive-grid">
                  {MOTIVE_OPTIONS.map((opt) => (
                    <label key={opt.value} className={`motive-option${form.motives.includes(opt.value) ? ' selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.motives.includes(opt.value)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.motives, opt.value]
                            : form.motives.filter((m) => m !== opt.value);
                          setForm({ ...form, motives: next });
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: Location */}
          {step === 'location' && (
            <div className="wizard-panel">
              <h2>Where did this happen?</h2>
              <p className="form-hint">We protect location privacy. You choose the precision level. Exact coordinates are never published without editorial approval.</p>
              <div className="form-group">
                <label className="form-label">Province</label>
                <select className="form-input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}>
                  <option value="">Select province...</option>
                  {['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Town / nearest town (optional)</label>
                <input type="text" className="form-input" placeholder="e.g. Vryburg, Tzaneen, Graaff-Reinet" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} />
              </div>
            </div>
          )}

          {/* Step: Sources */}
          {step === 'sources' && (
            <div className="wizard-panel">
              <h2>Do you have any sources?</h2>
              <p className="form-hint">Links to news articles, social media posts, or official statements help our editors verify your report faster.</p>
              <div className="form-group">
                <label className="form-label">Source name (optional)</label>
                <input type="text" className="form-input" placeholder="e.g. News24, SAPS statement, community WhatsApp" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">URL (optional)</label>
                <input type="url" className="form-input" placeholder="https://..." value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">In your own words (optional)</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Add anything else that helps — context, what sources say, who to contact for confirmation…"
                  value={form.notes}
                  onChange={(e) => {
                    const val = e.target.value;
                    const words = val.trim() ? val.trim().split(/\s+/) : [];
                    // hard-cap at 300 words
                    setForm({ ...form, notes: words.length > MAX_NOTE_WORDS ? words.slice(0, MAX_NOTE_WORDS).join(' ') : val });
                  }}
                />
                <div className={`note-wordcount${countWords(form.notes) >= MAX_NOTE_WORDS ? ' at-limit' : ''}`}>
                  {countWords(form.notes)} / {MAX_NOTE_WORDS} words
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Photos / files (optional)</label>
                <div className="upload-box">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILES}
                    style={{ display: 'none' }}
                    onChange={(e) => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: '-2px' }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add files
                  </button>
                  <span className="upload-meta">{files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''} · ${formatBytes(totalBytes)}` : 'Attach files'}</span>
                </div>
                <p className="form-hint" style={{ marginTop: 6, marginBottom: 0 }}>Images, PDF, Word, Excel, CSV and text files accepted.</p>
                {fileError && <div className="upload-error">{fileError}</div>}
                {files.length > 0 && (
                  <div className="upload-list">
                    {files.map((f) => (
                      <div key={`${f.name}-${f.size}`} className="upload-item">
                        <span className="upload-item-name">{f.name}</span>
                        <span className="upload-item-size">{formatBytes(f.size)}</span>
                        <button type="button" className="upload-item-remove" onClick={() => removeFile(f.name, f.size)} title="Remove">×</button>
                      </div>
                    ))}
                    <div className="upload-total">
                      <div className="upload-total-bar"><div style={{ width: `${Math.min(100, (totalBytes / SOFT_LIMIT_BYTES) * 100)}%`, background: oversized ? '#d69e2e' : undefined }} /></div>
                      <span>{formatBytes(totalBytes)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="wizard-panel">
              <h2>Review your report</h2>
              <div className="review-summary">
                <div className="review-row"><span>Module</span><span>{MODULE_META[form.module as keyof typeof MODULE_META]?.label ?? '—'}</span></div>
                <div className="review-row"><span>Knowledge</span><span>{form.knowledgeType.replace(/_/g, ' ')}</span></div>
                <div className="review-row"><span>Title</span><span>{form.title}</span></div>
                <div className="review-row"><span>Date</span><span>{form.dateOccurred}</span></div>
                <div className="review-row"><span>Location</span><span>{form.town ? `${form.town}, ` : ''}{form.province}</span></div>
                {form.sourceName && <div className="review-row"><span>Source</span><span>{form.sourceName}</span></div>}
                {files.length > 0 && <div className="review-row"><span>Attachments</span><span>{files.length} file{files.length !== 1 ? 's' : ''} · {formatBytes(totalBytes)}</span></div>}
                {form.notes.trim() && <div className="review-row"><span>Notes</span><span>{countWords(form.notes)} words</span></div>}
                {form.motives.length > 0 && <div className="review-row"><span>Context</span><span>{form.motives.map((m) => MOTIVE_OPTIONS.find((o) => o.value === m)?.label ?? m).join(', ')}</span></div>}
              </div>
              <div className="review-description">
                <h3>Description</h3>
                <p>{form.description}</p>
              </div>
              <label className="declaration-check">
                <input type="checkbox" checked={form.declaration} onChange={(e) => setForm({ ...form, declaration: e.target.checked })} />
                <span>I declare that this information is true to the best of my knowledge. I understand that this report will be reviewed by an editorial team before publication and that deliberately false reports may lead to account suspension.</span>
              </label>
            </div>
          )}

          {/* Navigation */}
          <div className="wizard-nav">
            {stepIndex > 0 && <button className="btn btn-secondary" onClick={goBack}>Back</button>}
            <div style={{ flex: 1 }} />
            {step !== 'review' ? (
              <button className="btn btn-primary" disabled={!canProceed()} onClick={goNext}>
                Continue
              </button>
            ) : (
              <button className="btn btn-primary" disabled={!canProceed()} onClick={handleSubmit}>
                Submit report
              </button>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
