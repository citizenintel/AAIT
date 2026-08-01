import { useCallback, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const TARGET_FIELDS = [
  { key: 'reporter', label: 'Reporter / name', hints: ['name', 'reporter', 'reported by', 'contact'], confidential: true },
  { key: 'dateOccurred', label: 'Date occurred', hints: ['date', 'occurred', 'when', 'datum'], confidential: false },
  { key: 'incidentType', label: 'Incident type', hints: ['type', 'incident', 'category', 'crime'], confidential: false },
  { key: 'location', label: 'Location / where', hints: ['location', 'where', 'town', 'place', 'address', 'farm'], confidential: false },
  { key: 'province', label: 'Province', hints: ['province', 'provinsie', 'region'], confidential: false },
  { key: 'sapsNumber', label: 'SAPS case number', hints: ['saps', 'case', 'cas', 'docket', 'reference', 'ref'], confidential: true },
  { key: 'severity', label: 'Severity', hints: ['severity', 'priority', 'level'], confidential: false },
  { key: 'summary', label: 'Summary / notes', hints: ['summary', 'notes', 'description', 'detail', 'remarks'], confidential: false },
  { key: 'contactPhone', label: 'Phone number', hints: ['phone', 'tel', 'cell', 'mobile', 'contact number'], confidential: true },
  { key: 'contactEmail', label: 'Email address', hints: ['email', 'e-mail', 'epos'], confidential: true },
  { key: 'casualties', label: 'Casualties', hints: ['casualties', 'killed', 'injured', 'deceased', 'dead'], confidential: false },
] as const;

type TargetKey = typeof TARGET_FIELDS[number]['key'];

interface ImportedAttachment {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  type: string;
  isImage: boolean;
  thumbnailUrl: string | null;
  compressedBlob: Blob | null;
  compressedSizeBytes: number | null;
  status: 'pending' | 'approved' | 'rejected';
  retainUntil: string;
  keepForever: boolean;
}

interface AISortedRow {
  public: Record<string, string>;
  confidential: Record<string, string>;
  rawRow: string[];
  confidence: number;
  module: string;
  severity: string;
  warnings: string[];
  flags: AIFlag[];
}

interface AIFlag {
  type: 'gap' | 'inaccurate' | 'fake_news' | 'suspicious';
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// CSV/TSV parser
// ---------------------------------------------------------------------------

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
      // skip
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

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function extractPdfText(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;
    let currentLine = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round((item as { transform: number[] }).transform[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = '';
      }
      currentLine += (currentLine ? ' ' : '') + item.str;
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    pages.push(lines.join('\n'));
  }
  return pages;
}

function splitPdfIntoIncidents(pages: string[]): string[][] {
  const fullText = pages.join('\n\n');

  const numberedPattern = /(?:^|\n)(?:\d+[\.\)]\s|[-•]\s|Incident\s*[:#]?\s*\d+)/i;
  const hasNumbered = numberedPattern.test(fullText);

  const chunks: string[] = [];

  if (hasNumbered) {
    const parts = fullText.split(/\n(?=\d+[\.\)]\s|[-•]\s|Incident\s*[:#]?\s*\d+)/i);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 20) chunks.push(trimmed);
    }
  }

  if (chunks.length === 0) {
    const paragraphs = fullText.split(/\n{2,}/);
    let buffer = '';
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (buffer && (buffer.length + trimmed.length > 500 || /\b(date|location|incident|attack|report)\b/i.test(trimmed))) {
        if (buffer.length > 30) chunks.push(buffer);
        buffer = trimmed;
      } else {
        buffer += (buffer ? '\n' : '') + trimmed;
      }
    }
    if (buffer.length > 30) chunks.push(buffer);
  }

  if (chunks.length === 0 && fullText.trim().length > 30) {
    chunks.push(fullText.trim());
  }

  return chunks.map(chunk => {
    const dateMatch = chunk.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{2}[\/-]\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})\b/i);
    const locationMatch = chunk.match(/(?:in|at|near|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);

    const date = dateMatch?.[1] ?? '';
    const location = locationMatch?.[1] ?? '';

    return [
      '',           // reporter
      date,         // dateOccurred
      '',           // incidentType
      location,     // location
      '',           // province
      '',           // sapsNumber
      '',           // severity
      chunk,        // summary — full text goes here for AI Sort to process
      '',           // contactPhone
      '',           // contactEmail
      '',           // casualties
    ];
  });
}

// ---------------------------------------------------------------------------
// DOCX text extraction
// ---------------------------------------------------------------------------

async function extractDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// ---------------------------------------------------------------------------
// AI sort engine (deterministic mock — server-side AI in production)
// ---------------------------------------------------------------------------

const SA_PHONE_RE = /(\+?27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const CASE_REF_RE = /\b(CAS|CASE|MAS|CR)\s?\d+[\/\-]\d+[\/\-]?\d*/gi;
const NAME_RE = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
const NOT_A_NAME = /^(SAPS|Police|Water|Municipality|Metro|Council|News|Hospital|Dam|Road|Street|Avenue|Zone|Cape|Town|Province|Department|Eskom|Johannesburg|Pretoria|Polokwane|Soweto|Musina|Limpopo|Gauteng|Western|Eastern|Northern|Free|North|South|The|Two|Three|Traffic|Residents)$/;

const MODULE_KEYWORDS: Record<string, string[]> = {
  ait: ['farm', 'rural', 'attack', 'farm attack', 'plaasaanval', 'smallholding', 'farmer'],
  unrest: ['protest', 'riot', 'unrest', 'looting', 'barricade', 'strike', 'demonstration'],
  bias: ['hate', 'xenophob', 'racist', 'discrimination', 'intimidation', 'bias'],
  infrastructure: ['water', 'electricity', 'eskom', 'loadshed', 'outage', 'pipe', 'cable theft', 'service delivery'],
  natural: ['flood', 'fire', 'drought', 'storm', 'wildfire', 'earthquake', 'weather'],
  traffic: ['accident', 'crash', 'collision', 'road', 'n1', 'n2', 'n3', 'r21', 'rollover', 'pile-up', 'highway'],
};

const SEVERITY_KEYWORDS: Record<string, string[]> = {
  critical: ['killed', 'murder', 'deceased', 'dead', 'fatal', 'critical', 'shot dead'],
  high: ['assault', 'attack', 'hospitalised', 'serious', 'armed', 'shot', 'stabbed', 'robbery'],
  medium: ['protest', 'blockade', 'theft', 'outage', 'damage', 'fire'],
  low: ['minor', 'warning', 'advisory', 'delay', 'disruption'],
};

const PROVINCES = ['Gauteng', 'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'KwaZulu-Natal', 'Eastern Cape', 'Western Cape', 'Northern Cape'];

const FAKE_NEWS_SIGNALS: string[] = [
  'share before they delete', 'they don\'t want you to know', 'wake up', 'mainstream media won\'t tell',
  'forwarded as received', 'please share', 'this is being suppressed', 'unconfirmed but', 'a friend told me',
  'reportedly', 'allegedly happened', 'sources say', 'whatsapp', 'sent via whatsapp',
];

const SUSPICIOUS_DOMAINS: string[] = [
  'bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly',
];

function detectFakeNewsSignals(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const sig of FAKE_NEWS_SIGNALS) {
    if (lower.includes(sig)) hits.push(sig);
  }
  for (const d of SUSPICIOUS_DOMAINS) {
    if (lower.includes(d)) hits.push(`contains short URL (${d})`);
  }
  if (/!!{2,}|\?{3,}|[A-Z]{10,}/.test(text)) hits.push('excessive punctuation or all-caps');
  return hits;
}

function classifyModule(text: string): string {
  const lower = text.toLowerCase();
  let best = 'ait';
  let bestScore = 0;
  for (const [mod, kws] of Object.entries(MODULE_KEYWORDS)) {
    const score = kws.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = mod; }
  }
  return best;
}

function classifySeverity(text: string): string {
  const lower = text.toLowerCase();
  for (const [sev, kws] of Object.entries(SEVERITY_KEYWORDS)) {
    if (kws.some(k => lower.includes(k))) return sev;
  }
  return 'medium';
}

function extractProvinceFromText(text: string): string {
  for (const p of PROVINCES) {
    if (text.toLowerCase().includes(p.toLowerCase())) return p;
  }
  return '';
}

function redactText(text: string): { clean: string; extracted: string[] } {
  const extracted: string[] = [];

  let clean = text;
  (clean.match(EMAIL_RE) ?? []).forEach(m => extracted.push(`Email: ${m}`));
  clean = clean.replace(EMAIL_RE, '[email withheld]');

  (clean.match(SA_PHONE_RE) ?? []).forEach(m => extracted.push(`Phone: ${m.trim()}`));
  clean = clean.replace(SA_PHONE_RE, '[contact withheld]');

  (clean.match(CASE_REF_RE) ?? []).forEach(m => extracted.push(`Case ref: ${m}`));
  clean = clean.replace(CASE_REF_RE, '[case ref withheld]');

  clean = clean.replace(NAME_RE, (m, a, b) => {
    if (NOT_A_NAME.test(a) || NOT_A_NAME.test(b)) return m;
    extracted.push(`Name: ${m}`);
    return '[name withheld]';
  });

  return { clean: clean.replace(/\s{2,}/g, ' ').trim(), extracted };
}

function aiSortRow(
  row: string[],
  mapping: Record<TargetKey, number | -1>,
): AISortedRow {
  const get = (key: TargetKey): string => {
    const idx = mapping[key];
    return idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  const allText = row.join(' ');
  const summary = get('summary');
  const { clean: cleanSummary, extracted } = redactText(summary);

  const publicFields: Record<string, string> = {};
  const confidentialFields: Record<string, string> = {};
  const warnings: string[] = [];
  const flags: AIFlag[] = [];

  for (const f of TARGET_FIELDS) {
    const val = get(f.key);
    if (!val) {
      flags.push({ type: 'gap', field: f.label, message: `No data provided for "${f.label}" — left blank` });
      continue;
    }
    if (f.confidential) {
      confidentialFields[f.label] = val;
    } else if (f.key === 'summary') {
      publicFields[f.label] = cleanSummary;
      if (extracted.length > 0) {
        confidentialFields['PII extracted from text'] = extracted.join('; ');
      }
    } else {
      publicFields[f.label] = val;
    }
  }

  const module = classifyModule(allText);
  const severity = classifySeverity(allText);

  publicFields['Module'] = module;
  publicFields['AI Severity'] = severity;

  const province = get('province') || extractProvinceFromText(allText);
  if (province) publicFields['Province'] = province;

  if (extracted.length > 0) {
    warnings.push(`${extracted.length} PII item${extracted.length > 1 ? 's' : ''} extracted and moved to confidential`);
  }
  if (!get('dateOccurred')) {
    warnings.push('No date detected — review required');
    flags.push({ type: 'gap', field: 'Date', message: 'No date found in submission — left blank for admin review' });
  }
  if (!province) {
    warnings.push('No province detected — manual assignment needed');
    flags.push({ type: 'gap', field: 'Province', message: 'Province could not be determined — left blank' });
  }

  const fakeSignals = detectFakeNewsSignals(allText);
  if (fakeSignals.length > 0) {
    flags.push({ type: 'fake_news', field: 'Content', message: `Possible fake/unverified content: ${fakeSignals.join(', ')}` });
    warnings.push(`Fake news signals detected (${fakeSignals.length})`);
  }

  const dateVal = get('dateOccurred');
  if (dateVal) {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      flags.push({ type: 'inaccurate', field: 'Date', message: `Date "${dateVal}" is not a valid date format` });
    } else if (d.getTime() > Date.now() + 86400000) {
      flags.push({ type: 'inaccurate', field: 'Date', message: `Date "${dateVal}" is in the future — likely incorrect` });
    }
  }

  if (summary.length < 15 && summary.length > 0) {
    flags.push({ type: 'suspicious', field: 'Summary', message: 'Very short description — may lack useful detail' });
  }

  const mappedFields = Object.values(mapping).filter(v => v >= 0).length;
  const confidence = Math.min(100, Math.round((mappedFields / TARGET_FIELDS.length) * 80 + (province ? 10 : 0) + (get('dateOccurred') ? 10 : 0)));

  return { public: publicFields, confidential: confidentialFields, rawRow: row, confidence, module, severity, warnings, flags };
}

// ---------------------------------------------------------------------------
// Image compression (canvas downscale, quality reduction)
// ---------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB threshold
const TARGET_MAX_DIM = 1920;
const JPEG_QUALITY = 0.82;

async function compressImage(file: File): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, TARGET_MAX_DIM / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) { reject(new Error('Compression failed')); return; }
          const url = URL.createObjectURL(blob);
          resolve({ blob, url });
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image')); };
    img.src = objectUrl;
  });
}

async function createThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const size = 120;
      const scale = Math.min(size / img.width, size / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Thumbnail failed')); };
    img.src = objectUrl;
  });
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function daysLeft(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

function retentionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

const MODULE_LABELS: Record<string, { label: string; colour: string }> = {
  ait: { label: 'Farm & Rural', colour: '#c53030' },
  unrest: { label: 'Unrest Watch', colour: '#ed8936' },
  bias: { label: 'Bias Monitor', colour: '#805ad5' },
  infrastructure: { label: 'Infrastructure', colour: '#3182ce' },
  natural: { label: 'Natural Events', colour: '#38a169' },
  traffic: { label: 'Traffic', colour: '#718096' },
};

const SEV_COLOURS: Record<string, string> = {
  critical: '#c53030', high: '#ed8936', medium: '#d69e2e', low: '#38a169', informational: '#718096',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  // File / CSV state
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, number | -1>>({} as Record<TargetKey, number | -1>);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // AI sort state
  const [sortedRows, setSortedRows] = useState<AISortedRow[]>([]);
  const [sorting, setSorting] = useState(false);
  const [sorted, setSorted] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<ImportedAttachment[]>([]);
  const [compressing, setCompressing] = useState(false);

  // Import state
  const [imported, setImported] = useState<number | null>(null);

  // PDF state
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [isPdf, setIsPdf] = useState(false);

  // Expanded row detail
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const reset = () => {
    setHeaders([]); setDataRows([]); setMapping({} as Record<TargetKey, number | -1>);
    setError(''); setNotice(''); setSortedRows([]); setSorting(false); setSorted(false);
    setImported(null); setFileName('');
    setPdfExtracting(false); setPdfPageCount(0); setIsPdf(false);
    attachments.forEach(a => { if (a.thumbnailUrl) URL.revokeObjectURL(a.thumbnailUrl); });
    setAttachments([]); setExpandedRow(null);
  };

  const handleFile = (file: File) => {
    reset();
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'pdf') {
      setIsPdf(true);
      setPdfExtracting(true);
      extractPdfText(file)
        .then(pages => {
          setPdfPageCount(pages.length);
          const rows = splitPdfIntoIncidents(pages);
          if (rows.length === 0) {
            setError('Could not extract any incident records from this PDF.');
            setPdfExtracting(false);
            return;
          }
          const pdfHeaders = TARGET_FIELDS.map(f => f.label);
          setHeaders(pdfHeaders);
          setDataRows(rows);
          const autoMap = {} as Record<TargetKey, number | -1>;
          TARGET_FIELDS.forEach((f, i) => { autoMap[f.key] = i; });
          setMapping(autoMap);
          setPdfExtracting(false);
        })
        .catch(() => {
          setError('Failed to read PDF — the file may be encrypted or corrupted.');
          setPdfExtracting(false);
        });
      return;
    }

    if (['xlsx', 'xls'].includes(ext)) {
      setNotice('Spreadsheet detected — XLS/XLSX files are parsed server-side (SheetJS). Export as CSV for local preview and column mapping.');
      return;
    }
    if (ext === 'docx') {
      setIsPdf(true);
      setPdfExtracting(true);
      extractDocxText(file)
        .then(text => {
          const rows = splitPdfIntoIncidents([text]);
          if (rows.length === 0) {
            setError('Could not extract any incident records from this document.');
            setPdfExtracting(false);
            return;
          }
          const docHeaders = TARGET_FIELDS.map(f => f.label);
          setHeaders(docHeaders);
          setDataRows(rows);
          const autoMap = {} as Record<TargetKey, number | -1>;
          TARGET_FIELDS.forEach((f, i) => { autoMap[f.key] = i; });
          setMapping(autoMap);
          setPdfPageCount(1);
          setPdfExtracting(false);
        })
        .catch(() => {
          setError('Failed to read document — the file may be corrupted or password-protected.');
          setPdfExtracting(false);
        });
      return;
    }
    if (ext === 'doc') {
      setNotice('Legacy .doc format detected — please save as .docx or .pdf and re-upload for automatic extraction.');
      return;
    }
    if (!['csv', 'tsv', 'txt'].includes(ext)) {
      setError(`Unsupported file type: .${ext}. Use CSV, TSV, XLS, XLSX, DOC/DOCX, or PDF.`);
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

  // Attachment handling
  const handleAttachments = useCallback(async (files: FileList) => {
    setCompressing(true);
    const newAttachments: ImportedAttachment[] = [];

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      let thumbnailUrl: string | null = null;
      let compressedBlob: Blob | null = null;
      let compressedSize: number | null = null;

      if (isImage) {
        try {
          thumbnailUrl = await createThumbnail(file);
        } catch { /* skip thumbnail */ }

        if (file.size > MAX_IMAGE_BYTES) {
          try {
            const result = await compressImage(file);
            compressedBlob = result.blob;
            compressedSize = result.blob.size;
          } catch { /* keep original */ }
        }
      }

      newAttachments.push({
        id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        name: file.name,
        sizeBytes: file.size,
        type: file.type,
        isImage,
        thumbnailUrl,
        compressedBlob,
        compressedSizeBytes: compressedSize,
        status: 'pending',
        retainUntil: retentionDate(),
        keepForever: false,
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setCompressing(false);
  }, []);

  const updateAttachment = useCallback((id: string, updates: Partial<ImportedAttachment>) => {
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const a = prev.find(x => x.id === id);
      if (a?.thumbnailUrl) URL.revokeObjectURL(a.thumbnailUrl);
      return prev.filter(x => x.id !== id);
    });
  }, []);

  // AI Sort
  const runAISort = useCallback(async () => {
    if (dataRows.length === 0) return;
    setSorting(true);
    // Simulate processing delay for UX
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

    const results = dataRows.map(row => aiSortRow(row, mapping));
    setSortedRows(results);
    setSorted(true);
    setSorting(false);
  }, [dataRows, mapping]);

  // Import
  const runImport = () => {
    setImported(sorted ? sortedRows.length : dataRows.length);
  };

  const mappedCount = useMemo(() => Object.values(mapping).filter((v) => v >= 0).length, [mapping]);

  const stats = useMemo(() => {
    if (sortedRows.length === 0) return null;
    const modules: Record<string, number> = {};
    const severities: Record<string, number> = {};
    let piiCount = 0;
    let warningCount = 0;
    let flagCount = 0;
    let fakeNewsCount = 0;
    let gapCount = 0;
    for (const r of sortedRows) {
      modules[r.module] = (modules[r.module] ?? 0) + 1;
      severities[r.severity] = (severities[r.severity] ?? 0) + 1;
      if (Object.keys(r.confidential).length > 0) piiCount++;
      warningCount += r.warnings.length;
      flagCount += r.flags.length;
      fakeNewsCount += r.flags.filter(f => f.type === 'fake_news').length;
      gapCount += r.flags.filter(f => f.type === 'gap').length;
    }
    return { modules, severities, piiCount, warningCount, flagCount, fakeNewsCount, gapCount, avgConfidence: Math.round(sortedRows.reduce((s, r) => s + r.confidence, 0) / sortedRows.length) };
  }, [sortedRows]);

  const oversizedAttachments = attachments.filter(a => a.sizeBytes > MAX_IMAGE_BYTES);
  const pendingAttachments = attachments.filter(a => a.status === 'pending');

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Import Data</h1>
        <p>Upload incident records, attach evidence files, and use AI to sort public vs. confidential fields. Everything enters the review queue — nothing publishes automatically.</p>
      </div>

      {/* ── Upload zone ──────────────────────────────────────────────── */}
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
          <div className="import-dropzone-sub">CSV / TSV / PDF parsed here · XLS / XLSX / DOC handled on upload</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xls,.xlsx,.doc,.docx,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
        {error && <div className="import-msg error">{error}</div>}
        {notice && <div className="import-msg notice">{notice}</div>}
        {pdfExtracting && (
          <div className="import-msg notice" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner-dot" />
            Extracting text from document — reading content…
          </div>
        )}
        {isPdf && !pdfExtracting && dataRows.length > 0 && (
          <div className="import-msg notice">
            Document extracted — {dataRows.length} potential incident{dataRows.length !== 1 ? 's' : ''} identified. Fields are auto-mapped. Use <strong>AI Sort</strong> to classify, extract PII, and assess each record.
          </div>
        )}
      </div>

      {/* ── Attachments / Evidence ────────────────────────────────────── */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Evidence Attachments</h2>
          <button className="btn btn-secondary" onClick={() => attachRef.current?.click()} disabled={compressing}>
            {compressing ? 'Processing…' : '+ Add files'}
          </button>
          <input
            ref={attachRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleAttachments(e.target.files); }}
          />
        </div>

        {attachments.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No attachments yet. Add photos, scans of police reports, or other evidence files.
            <br />Images over 1 MB are automatically compressed. Originals kept for 7 days.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {attachments.map(a => (
              <div key={a.id} style={{
                display: 'grid', gridTemplateColumns: a.isImage && a.thumbnailUrl ? '60px 1fr auto' : '1fr auto',
                gap: 10, padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)',
                alignItems: 'center',
              }}>
                {a.isImage && a.thumbnailUrl && (
                  <img src={a.thumbnailUrl} alt={a.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{formatBytes(a.sizeBytes)}</span>
                    {a.compressedSizeBytes && (
                      <span style={{ color: '#38a169' }}>→ {formatBytes(a.compressedSizeBytes)} compressed</span>
                    )}
                    {a.sizeBytes > MAX_IMAGE_BYTES && !a.compressedBlob && !a.isImage && (
                      <span style={{ color: '#ed8936' }}>Large file — 7-day retention</span>
                    )}
                    <span>·</span>
                    {a.isImage ? (
                      <span style={{ color: a.status === 'approved' ? '#38a169' : a.status === 'rejected' ? '#c53030' : '#d69e2e' }}>
                        {a.status === 'approved' ? '✓ Approved for public' : a.status === 'rejected' ? '✗ Confidential only' : '◌ Pending review'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Document — admin only</span>
                    )}
                  </div>
                  {a.sizeBytes > MAX_IMAGE_BYTES && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Original retained until {a.retainUntil} ({daysLeft(a.retainUntil)}d left)</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 10, color: a.keepForever ? '#38a169' : 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={a.keepForever}
                          onChange={(e) => updateAttachment(a.id, { keepForever: e.target.checked })}
                          style={{ width: 12, height: 12 }}
                        />
                        Keep permanently
                      </label>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                  {a.isImage && (
                    <>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11, background: a.status === 'approved' ? 'rgba(56,161,105,0.2)' : undefined, color: a.status === 'approved' ? '#38a169' : undefined }}
                        onClick={() => updateAttachment(a.id, { status: a.status === 'approved' ? 'pending' : 'approved' })}
                        title="Approve for public viewing"
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11, background: a.status === 'rejected' ? 'rgba(197,48,48,0.2)' : undefined, color: a.status === 'rejected' ? '#c53030' : undefined }}
                        onClick={() => updateAttachment(a.id, { status: a.status === 'rejected' ? 'pending' : 'rejected' })}
                        title="Keep confidential (admin only)"
                      >
                        ✗
                      </button>
                    </>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => removeAttachment(a.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {oversizedAttachments.length > 0 && (
          <div className="import-msg warning" style={{ marginTop: 8 }}>
            <strong>{oversizedAttachments.length} oversized file{oversizedAttachments.length > 1 ? 's' : ''}</strong> — originals stored in 7-day retention queue.
            {' '}Check "Keep permanently" for files that should not auto-delete. All others are removed after 7 days to save storage.
          </div>
        )}
      </div>

      {/* ── Column mapping ───────────────────────────────────────────── */}
      {headers.length > 0 && (
        <>
          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>Map Columns to Fields</h2>
                <p className="form-hint" style={{ margin: '4px 0 0' }}>{mappedCount} of {TARGET_FIELDS.length} fields mapped. Confidential fields marked with 🔒</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={runAISort}
                disabled={sorting || mappedCount === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: sorted ? '#38a169' : undefined }}
              >
                {sorting ? (
                  <><span className="spinner-dot" /> Sorting…</>
                ) : sorted ? (
                  '✓ AI Sorted'
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a4 4 0 014 4c0 1.5-.8 2.8-2 3.5v1h-4v-1c-1.2-.7-2-2-2-3.5a4 4 0 014-4z" />
                      <path d="M10 14.5h4M10 17h4M11 19.5h2" />
                    </svg>
                    AI Sort Data
                  </>
                )}
              </button>
            </div>
            <div className="import-map-grid">
              {TARGET_FIELDS.map((f) => (
                <div key={f.key} className="import-map-row">
                  <span className="import-map-target">
                    {f.confidential && <span style={{ marginRight: 4 }} title="Confidential — admin only">🔒</span>}
                    {f.label}
                  </span>
                  <select
                    className="form-input"
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => { setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) })); setSorted(false); setSortedRows([]); }}
                  >
                    <option value={-1}>— not mapped —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* ── AI Sort results ─────────────────────────────────────────── */}
          {sorted && sortedRows.length > 0 && stats && (
            <>
              <div className="admin-card">
                <h2>AI Sort Summary</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{sortedRows.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Records sorted</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#c53030' }}>{stats.piiCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>With PII extracted</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#d69e2e' }}>{stats.warningCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Warnings</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#38a169' }}>{stats.avgConfidence}%</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg confidence</div>
                  </div>
                  {stats.fakeNewsCount > 0 && (
                    <div style={{ background: '#ef444422', padding: '10px 12px', borderRadius: 6, border: '1px solid #ef444444' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{stats.fakeNewsCount}</div>
                      <div style={{ fontSize: 11, color: '#ef4444' }}>Fake news flags</div>
                    </div>
                  )}
                  <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>{stats.gapCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Data gaps (blank)</div>
                  </div>
                </div>

                {/* Module breakdown */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {Object.entries(stats.modules).map(([mod, count]) => (
                    <span key={mod} style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 10,
                      background: (MODULE_LABELS[mod]?.colour ?? '#666') + '22',
                      border: `1px solid ${MODULE_LABELS[mod]?.colour ?? '#666'}44`,
                      color: MODULE_LABELS[mod]?.colour ?? '#ccc',
                    }}>
                      {MODULE_LABELS[mod]?.label ?? mod} ({count})
                    </span>
                  ))}
                </div>

                {/* Severity breakdown */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(stats.severities).map(([sev, count]) => (
                    <span key={sev} style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 10,
                      background: (SEV_COLOURS[sev] ?? '#666') + '22',
                      border: `1px solid ${SEV_COLOURS[sev] ?? '#666'}44`,
                      color: SEV_COLOURS[sev] ?? '#ccc', textTransform: 'capitalize',
                    }}>
                      {sev} ({count})
                    </span>
                  ))}
                </div>
              </div>

              {/* Row-by-row results */}
              <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ margin: 0 }}>Sorted Records</h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sortedRows.length} rows · click to expand</span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {sortedRows.map((row, i) => {
                    const expanded = expandedRow === i;
                    const modMeta = MODULE_LABELS[row.module];
                    return (
                      <div key={i}>
                        <div
                          onClick={() => setExpandedRow(expanded ? null : i)}
                          style={{
                            display: 'grid', gridTemplateColumns: '24px 80px 60px 1fr auto',
                            gap: 8, alignItems: 'center', padding: '8px 10px',
                            background: expanded ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                            borderRadius: expanded ? '6px 6px 0 0' : 6,
                            border: `1px solid ${expanded ? (modMeta?.colour ?? 'var(--border)') + '44' : 'var(--border)'}`,
                            cursor: 'pointer', fontSize: 12, transition: 'background 0.15s',
                          }}
                        >
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{i + 1}</span>
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 8, textAlign: 'center',
                            background: (modMeta?.colour ?? '#666') + '22', color: modMeta?.colour ?? '#ccc',
                            border: `1px solid ${(modMeta?.colour ?? '#666')}44`,
                          }}>
                            {modMeta?.label ?? row.module}
                          </span>
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 8, textAlign: 'center',
                            background: (SEV_COLOURS[row.severity] ?? '#666') + '22', color: SEV_COLOURS[row.severity] ?? '#ccc',
                            textTransform: 'capitalize',
                          }}>
                            {row.severity}
                          </span>
                          <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.public['Summary / notes'] || row.public['Location / where'] || row.rawRow[0] || '—'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.flags.some(f => f.type === 'fake_news') && (
                              <span title="Possible fake news detected" style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>🚩 FAKE?</span>
                            )}
                            {row.flags.some(f => f.type === 'inaccurate') && (
                              <span title="Inaccurate data flagged" style={{ fontSize: 10, color: '#ef4444' }}>❌</span>
                            )}
                            {row.warnings.length > 0 && (
                              <span title={row.warnings.join('\n')} style={{ fontSize: 10, color: '#d69e2e' }}>⚠ {row.warnings.length}</span>
                            )}
                            {Object.keys(row.confidential).length > 0 && (
                              <span style={{ fontSize: 10, color: '#c53030' }} title="Contains confidential data">🔒</span>
                            )}
                            <span style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 4,
                              background: row.confidence >= 70 ? 'rgba(56,161,105,0.15)' : row.confidence >= 40 ? 'rgba(214,158,46,0.15)' : 'rgba(197,48,48,0.15)',
                              color: row.confidence >= 70 ? '#38a169' : row.confidence >= 40 ? '#d69e2e' : '#c53030',
                            }}>
                              {row.confidence}%
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {expanded && (
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12,
                            background: 'var(--bg-surface)', borderRadius: '0 0 6px 6px',
                            border: `1px solid ${(modMeta?.colour ?? 'var(--border)')}44`, borderTop: 'none',
                          }}>
                            {/* Public fields */}
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#38a169', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                Public — visible on map
                              </div>
                              {Object.entries(row.public).map(([key, val]) => (
                                <div key={key} style={{ fontSize: 11, marginBottom: 3 }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{key}: </span>
                                  <span style={{ color: 'var(--text-primary)' }}>{val}</span>
                                </div>
                              ))}
                              {Object.keys(row.public).length === 0 && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No public fields mapped</div>
                              )}
                            </div>

                            {/* Confidential fields */}
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#c53030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                🔒 Confidential — admin only
                              </div>
                              {Object.entries(row.confidential).map(([key, val]) => (
                                <div key={key} style={{ fontSize: 11, marginBottom: 3 }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{key}: </span>
                                  <span style={{ color: '#e78' }}>{val}</span>
                                </div>
                              ))}
                              {Object.keys(row.confidential).length === 0 && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No confidential data detected</div>
                              )}
                              {row.warnings.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {row.warnings.map((w, wi) => (
                                    <div key={wi} style={{ fontSize: 10, color: '#d69e2e', marginBottom: 2 }}>⚠ {w}</div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {row.flags.length > 0 && (
                              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, color: 'var(--text-muted)' }}>
                                  AI Flags — admin review required
                                </div>
                                {row.flags.map((flag, fi) => (
                                  <div key={fi} style={{
                                    fontSize: 11, padding: '4px 8px', borderRadius: 4, marginBottom: 3,
                                    background: flag.type === 'fake_news' ? '#ef444418' : flag.type === 'inaccurate' ? '#ef444418' : flag.type === 'suspicious' ? '#f9731618' : 'var(--bg-elevated)',
                                    color: flag.type === 'fake_news' ? '#ef4444' : flag.type === 'inaccurate' ? '#ef4444' : flag.type === 'suspicious' ? '#f97316' : 'var(--text-secondary)',
                                    border: `1px solid ${flag.type === 'fake_news' || flag.type === 'inaccurate' ? '#ef444433' : flag.type === 'suspicious' ? '#f9731633' : 'var(--border)'}`,
                                  }}>
                                    <span style={{ fontWeight: 600 }}>
                                      {flag.type === 'fake_news' ? '🚩 POSSIBLE FAKE' : flag.type === 'inaccurate' ? '❌ INACCURATE' : flag.type === 'suspicious' ? '⚠ SUSPICIOUS' : '○ GAP'}
                                    </span>
                                    {' — '}{flag.field}: {flag.message}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Preview (before AI sort) ────────────────────────────────── */}
          {!sorted && headers.length > 0 && (
            <div className="admin-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Raw Preview</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dataRows.length} rows</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>{TARGET_FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => (
                      <th key={f.key}>
                        {f.confidential && <span title="Confidential" style={{ marginRight: 3 }}>🔒</span>}
                        {f.label}
                      </th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 8).map((r, ri) => (
                      <tr key={ri}>
                        {TARGET_FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => (
                          <td key={f.key} style={f.confidential ? { color: '#e78', fontStyle: 'italic' } : undefined}>
                            {r[mapping[f.key]] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataRows.length > 8 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Showing first 8 of {dataRows.length} rows. Use AI Sort to process all rows.</div>}
            </div>
          )}

          {/* ── Import button ──────────────────────────────────────────── */}
          <div className="admin-card">
            {imported === null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={runImport} disabled={mappedCount === 0 || (!sorted && dataRows.length === 0)}>
                  {sorted ? `Import ${sortedRows.length} sorted records to review queue` : `Import ${dataRows.length} records to review queue`}
                </button>
                <button className="btn btn-secondary" onClick={reset}>Cancel</button>
                {!sorted && <span style={{ fontSize: 12, color: '#d69e2e' }}>Tip: Use AI Sort first for automatic PII separation</span>}
                {attachments.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {attachments.length} attachment{attachments.length > 1 ? 's' : ''} will be linked
                    {pendingAttachments.length > 0 && <span style={{ color: '#d69e2e' }}> · {pendingAttachments.length} pending approval</span>}
                  </span>
                )}
              </div>
            ) : (
              <div className="import-msg success">
                ✓ {imported} records staged to the review queue from <strong>{fileName}</strong>.
                {sorted && <> AI separated public/confidential fields. </>}
                {attachments.length > 0 && (
                  <> {attachments.filter(a => a.status === 'approved').length} attachment{attachments.filter(a => a.status === 'approved').length !== 1 ? 's' : ''} approved for public, {attachments.filter(a => a.status !== 'approved').length} kept confidential. </>
                )}
                An editor must approve each record before it appears on the map.
                <div style={{ marginTop: 10 }}><button className="btn btn-secondary" onClick={reset}>Import another file</button></div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Retention queue ─────────────────────────────────────────── */}
      {attachments.filter(a => a.sizeBytes > MAX_IMAGE_BYTES).length > 0 && (
        <div className="admin-card">
          <h2>7-Day Retention Queue</h2>
          <p className="form-hint" style={{ marginBottom: 10 }}>
            Original files over 1 MB are stored for 7 days then auto-deleted. Check "Keep" to override.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Original size</th>
                  <th>Compressed</th>
                  <th>Expires</th>
                  <th>Days left</th>
                  <th>Keep</th>
                </tr>
              </thead>
              <tbody>
                {attachments.filter(a => a.sizeBytes > MAX_IMAGE_BYTES).map(a => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12 }}>{a.name}</td>
                    <td style={{ fontSize: 12 }}>{formatBytes(a.sizeBytes)}</td>
                    <td style={{ fontSize: 12, color: a.compressedSizeBytes ? '#38a169' : 'var(--text-muted)' }}>
                      {a.compressedSizeBytes ? formatBytes(a.compressedSizeBytes) : 'n/a'}
                    </td>
                    <td style={{ fontSize: 12 }}>{a.retainUntil}</td>
                    <td style={{ fontSize: 12 }}>
                      <span style={{ color: daysLeft(a.retainUntil) <= 2 ? '#c53030' : 'var(--text-secondary)' }}>
                        {daysLeft(a.retainUntil)}d
                      </span>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={a.keepForever}
                        onChange={(e) => updateAttachment(a.id, { keepForever: e.target.checked })}
                        title={a.keepForever ? 'Will be kept permanently' : 'Will auto-delete after retention period'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="admin-note">
        <strong>How AI Sort works:</strong> The AI engine scans each row to (1) classify the incident module and severity, (2) extract names, phone numbers, email addresses, and case references from free text and move them to a confidential store visible only to admins, (3) produce a clean public summary safe for map display. <strong>PDF import:</strong> Text is extracted page-by-page and split into individual incident records using paragraph boundaries and structural markers (numbered lists, headings). Dates and locations are auto-detected where possible. In production, this runs through a server-side AI model (Groq/Gemini) with the same PII-separation guardrails. Images attached to submissions are individually approvable — only approved images are ever visible to the public. Originals of large files are kept in a 7-day retention queue; admins can mark specific files for permanent storage.
      </div>
    </div>
  );
}
