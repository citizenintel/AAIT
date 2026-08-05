import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';

interface CorrectionFormProps {
  incidentId: string;
  incidentTitle: string;
  onClose: () => void;
}

const CORRECTABLE_FIELDS = [
  { value: 'title', label: 'Title / Headline' },
  { value: 'dateOccurred', label: 'Date of incident' },
  { value: 'location', label: 'Location (town/province)' },
  { value: 'category', label: 'Category / Type' },
  { value: 'severity', label: 'Severity' },
  { value: 'casualties', label: 'Casualties (deceased/injured)' },
  { value: 'summary', label: 'Summary / Description' },
  { value: 'sources', label: 'Source / Link' },
  { value: 'other', label: 'Other' },
];

export function CorrectionForm({ incidentId, incidentTitle, onClose }: CorrectionFormProps) {
  const addCorrection = useAppStore((s) => s.addCorrection);
  const [field, setField] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !suggestedValue || !reason) return;

    addCorrection({
      incidentId,
      incidentTitle,
      field,
      currentValue,
      suggestedValue,
      reason,
      submitterName: name,
      submitterEmail: email,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="correction-form correction-success">
        <div className="correction-success-icon">&#10003;</div>
        <h3>Correction submitted</h3>
        <p>An editor will review your suggestion. Thank you for helping improve accuracy.</p>
        <button className="correction-close-btn" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <form className="correction-form" onSubmit={handleSubmit}>
      <div className="correction-header">
        <h3>Submit a Correction</h3>
        <button type="button" className="correction-close-x" onClick={onClose}>&times;</button>
      </div>
      <p className="correction-subtitle">for: {incidentTitle}</p>

      <label className="correction-label">
        What needs correcting?
        <select value={field} onChange={(e) => setField(e.target.value)} required>
          <option value="">Select a field...</option>
          {CORRECTABLE_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      <label className="correction-label">
        Current value (what it says now)
        <input type="text" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="Optional" />
      </label>

      <label className="correction-label">
        Suggested correction *
        <textarea value={suggestedValue} onChange={(e) => setSuggestedValue(e.target.value)} required rows={2} placeholder="What it should say..." />
      </label>

      <label className="correction-label">
        Reason / source *
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={2} placeholder="How do you know? Link to a source if possible." />
      </label>

      <div className="correction-row">
        <label className="correction-label">
          Your name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </label>
        <label className="correction-label">
          Your email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
        </label>
      </div>

      <div className="correction-actions">
        <button type="button" className="correction-cancel-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="correction-submit-btn" disabled={!field || !suggestedValue || !reason}>
          Submit Correction
        </button>
      </div>
    </form>
  );
}
