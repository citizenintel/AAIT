import { useMemo, useRef, useState } from 'react';

/** Target fields an imported row can map into. */
const TARGET_FIELDS = [
  { key: 'reporter', label: 'Reporter / name', hints: ['name', 'reporter', 'reported by', 'contact'] },
  { key: 'dateOccurred', label: 'Date occurred', hints: ['date', 'occurred', 'when', 'datum'] },
  { key: 'incidentType', label: 'Incident type', hints: ['type', 'incident', 'category', 'crime'] },
  { key: 'location', label: 'Location / where', hints: ['location', 'where', 'town', 'place', 'address', 'farm'] },
  { key: 'province', label: 'Province', hints: ['province', 'provinsie', 'region'] },
  { key: 'sapsNumber', label: 'SAPS case number', hints: ['saps', 'case', 'cas', 'docket', 'reference', 'ref'] },
  { key: 'severity', label: 'Severity', hints: ['severity', 'priority', 'level'] },
  { key: 'summary', label: 'Summary / notes', hints: ['summary', 'notes', 'description', 'detail', 'remarks'] },
] as const;

type TargetKey = typeof TARGET_FIELDS[number]['key'];

/** Minimal RFC-4180-ish CSV/TSV parser: handles quoted fields, escaped quotes, CRLF. */
function parseDelimited(text: string): string[][] {
  const delim = text.includes('\t') && !text.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // ignore; handled by \n
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function guessMapping(headers: string[]): Record<TargetKey, number | -1> {
  const map = {} as Record<TargetKey, number | -1>;
  for (const f of TARGET_FIELDS) {
    const idx = headers.findIndex((h) => f.hints.some((hint) => h.toLowerCase().includes(hint)));
    map[f.key] = idx;
  }
  return map;
}

export function AdminImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, number | -1>>({} as Record<TargetKey, number | -1>);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [imported, setImported] = useState<number | null>(null);

  const reset = () => {
    setHeaders([]); setDataRows([]); setMapping({} as Record<TargetKey, number | -1>);
    setError(''); setNotice(''); setImported(null); setFileName('');
  };

  const handleFile = (file: File) => {
    reset();
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (['xlsx', 'xls'].includes(ext)) {
      setNotice('Spreadsheet detected. XLS/XLSX files are parsed on the server after upload (SheetJS) — this local preview parses CSV/TSV only. Export the sheet as CSV to preview and map it here.');
      return;
    }
    if (['doc', 'docx'].includes(ext)) {
      setNotice('Word document detected. Documents are not tabular, so they route to assisted extraction (a reviewer confirms each extracted field) rather than direct column mapping. Not auto-imported.');
      return;
    }
    if (!['csv', 'tsv', 'txt'].includes(ext)) {
      setError(`Unsupported file type: .${ext}. Use CSV or TSV here; XLS/DOC upload is handled server-side in production.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const grid = parseDelimited(String(reader.result ?? ''));
      if (grid.length < 2) { setError('File has no data rows.'); return; }
      const hdr = grid[0]!.map((h) => h.trim());
      setHeaders(hdr);
      setDataRows(grid.slice(1));
      setMapping(guessMapping(hdr));
    };
    reader.onerror = () => setError('Could not read the file.');
    reader.readAsText(file);
  };

  const mappedCount = useMemo(() => Object.values(mapping).filter((v) => v >= 0).length, [mapping]);

  const runImport = () => {
    // No backend yet — records would enter the review queue, never auto-published (spec §2.8).
    setImported(dataRows.length);
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Import Data</h1>
        <p>Bring incident records in from a file and map its columns to tracker fields. Imported records enter the review queue — nothing publishes automatically.</p>
      </div>

      <div className="admin-card">
        <div
          className="import-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <div className="import-dropzone-main">{fileName || 'Drop a file here, or click to choose'}</div>
          <div className="import-dropzone-sub">CSV / TSV parsed here · XLS / XLSX / DOC handled on upload</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xls,.xlsx,.doc,.docx"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {error && <div className="import-msg error">{error}</div>}
        {notice && <div className="import-msg notice">{notice}</div>}
      </div>

      {headers.length > 0 && (
        <>
          <div className="admin-card">
            <h2>Map columns to fields</h2>
            <p className="form-hint">We guessed a mapping from the headers — adjust any that are wrong. {mappedCount} of {TARGET_FIELDS.length} fields mapped.</p>
            <div className="import-map-grid">
              {TARGET_FIELDS.map((f) => (
                <div key={f.key} className="import-map-row">
                  <span className="import-map-target">{f.label}</span>
                  <select
                    className="form-input"
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  >
                    <option value={-1}>— not mapped —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Preview — mapped fields</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dataRows.length} rows</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>{TARGET_FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => <th key={f.key}>{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 8).map((r, ri) => (
                    <tr key={ri}>
                      {TARGET_FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => (
                        <td key={f.key}>{r[mapping[f.key]] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataRows.length > 8 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Showing first 8 of {dataRows.length} rows.</div>}
          </div>

          <div className="admin-card">
            {imported === null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={runImport} disabled={mappedCount === 0}>
                  Import {dataRows.length} records to review queue
                </button>
                <button className="btn btn-secondary" onClick={reset}>Cancel</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Records are staged for editorial review — never auto-published.</span>
              </div>
            ) : (
              <div className="import-msg success">
                ✓ {imported} records staged to the review queue from <strong>{fileName}</strong>. An editor must approve each before it appears on the map.
                <div style={{ marginTop: 10 }}><button className="btn btn-secondary" onClick={reset}>Import another file</button></div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="admin-note">
        Backend wiring pending — this preview parses and maps locally. In production, uploads stream to storage, XLS/DOC are parsed server-side, records validate against the schema, and every imported incident lands in the review queue (spec §2.8: nothing publishes automatically).
      </div>
    </div>
  );
}
