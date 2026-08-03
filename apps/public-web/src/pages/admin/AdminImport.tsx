import { useCallback, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { useAppStore } from '../../stores/app-store';
import type { MockIncident } from '../../data/mock-incidents';
import { splitAllMultiIncidents } from '../../lib/utils/incident-splitter';

GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const TARGET_FIELDS = [
  { key: 'victimName', label: 'Victim name', hints: ['victim', 'name', 'slain', 'murdered'], confidential: false },
  { key: 'dateOccurred', label: 'Date occurred', hints: ['date', 'occurred', 'when', 'datum'], confidential: false },
  { key: 'incidentType', label: 'Incident type', hints: ['type', 'incident', 'category', 'crime'], confidential: false },
  { key: 'location', label: 'Location / where', hints: ['location', 'where', 'town', 'place', 'address', 'farm'], confidential: false },
  { key: 'province', label: 'Province', hints: ['province', 'provinsie', 'region'], confidential: false },
  { key: 'severity', label: 'Severity', hints: ['severity', 'priority', 'level'], confidential: false },
  { key: 'summary', label: 'Summary / notes', hints: ['summary', 'notes', 'description', 'detail', 'remarks'], confidential: false },
  { key: 'casualties', label: 'Casualties', hints: ['casualties', 'killed', 'injured', 'deceased', 'dead'], confidential: false },
  { key: 'suspectName', label: 'Suspect name', hints: ['suspect', 'accused', 'perpetrator', 'attacker', 'arrested'], confidential: true },
  { key: 'courtCase', label: 'Court case / docket', hints: ['court', 'case', 'docket', 'saps', 'cas', 'reference', 'ref', 'trial'], confidential: true },
  { key: 'verdict', label: 'Verdict / outcome', hints: ['verdict', 'guilty', 'acquitted', 'sentenced', 'convicted', 'outcome', 'found'], confidential: false },
  { key: 'caseStatus', label: 'Case status', hints: ['status', 'resolved', 'unresolved', 'pending', 'closed', 'open', 'cold case'], confidential: false },
  { key: 'sourceUrl', label: 'Source URL', hints: ['url', 'source', 'link', 'reference', 'article'], confidential: false },
  { key: 'reporter', label: 'Reporter / contact', hints: ['reporter', 'reported by', 'contact', 'witness'], confidential: true },
  { key: 'contactPhone', label: 'Phone number', hints: ['phone', 'tel', 'cell', 'mobile', 'contact number'], confidential: true },
  { key: 'contactEmail', label: 'Email address', hints: ['email', 'e-mail', 'epos'], confidential: true },
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
// Duplicate / similarity detection
// ---------------------------------------------------------------------------

interface DuplicateMatch {
  newIncident: MockIncident;
  existing: MockIncident;
  score: number;
  reasons: string[];
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function extractName(title: string): string {
  const dash = title.indexOf(' — ');
  return dash > 0 ? normalise(title.slice(0, dash)) : normalise(title);
}

function wordOverlap(a: string, b: string): number {
  const wa = new Set(normalise(a).split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(normalise(b).split(/\s+/).filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(wa.size, wb.size);
}

function scoreSimilarity(a: MockIncident, b: MockIncident): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const nameA = extractName(a.title);
  const nameB = extractName(b.title);
  if (nameA && nameB && nameA === nameB) { score += 40; reasons.push('Same name'); }
  else if (nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA))) { score += 25; reasons.push('Similar name'); }
  if (a.dateOccurred && b.dateOccurred && a.dateOccurred === b.dateOccurred) { score += 25; reasons.push('Same date'); }
  if (a.town && b.town && normalise(a.town) === normalise(b.town)) { score += 20; reasons.push('Same town'); }
  if (a.province && b.province && normalise(a.province) === normalise(b.province)) { score += 10; reasons.push('Same province'); }
  const overlap = wordOverlap(a.summary, b.summary);
  if (overlap > 0.5) { score += Math.round(overlap * 15); reasons.push('Similar summary'); }
  return { score, reasons };
}

const DUPLICATE_THRESHOLD = 60;

function findDuplicates(incoming: MockIncident[], existing: MockIncident[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  for (const newInc of incoming) {
    for (const ext of existing) {
      const { score, reasons } = scoreSimilarity(newInc, ext);
      if (score >= DUPLICATE_THRESHOLD) {
        matches.push({ newIncident: newInc, existing: ext, score, reasons });
      }
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

function findInternalDuplicates(incidents: MockIncident[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  for (let i = 0; i < incidents.length; i++) {
    for (let j = i + 1; j < incidents.length; j++) {
      const { score, reasons } = scoreSimilarity(incidents[i]!, incidents[j]!);
      if (score >= DUPLICATE_THRESHOLD) {
        matches.push({ newIncident: incidents[j]!, existing: incidents[i]!, score, reasons });
      }
    }
  }
  return matches.sort((a, b) => b.score - a.score);
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
  const expectedCols = (text.split('\n')[0] ?? '').split(delim).length;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else if (c === '\n' && row.length + 1 >= expectedCols) {
        // Unbalanced quote — force-close at row boundary
        inQuotes = false;
        row.push(field); rows.push(row); row = []; field = '';
      } else {
        field += c;
      }
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
  if (inQuotes) { row.push(field); }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function guessMapping(headers: string[]): Record<TargetKey, number | -1> {
  const map = {} as Record<TargetKey, number | -1>;
  const claimed = new Set<number>();
  for (const f of TARGET_FIELDS) {
    const idx = headers.findIndex((h, i) => !claimed.has(i) && f.hints.some((hint) => h.toLowerCase().includes(hint)));
    map[f.key] = idx;
    if (idx >= 0) claimed.add(idx);
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

function extractVictimName(text: string): string {
  const patterns = [
    /(?:victim|deceased|slain|murdered|killed)\s*(?:was|is|:)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:was\s+(?:killed|murdered|slain|shot|stabbed|attacked))/,
    /(?:farmer|mr|mrs|ms|dr)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1] && !NOT_A_NAME.test(m[1].split(' ')[0] ?? '')) return m[1];
  }
  return '';
}

function extractSuspectInfo(text: string): string {
  const patterns = [
    /(?:suspect|accused|perpetrator|attacker|arrested)\s*(?:was|is|:)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
    /(\d+)\s*(?:suspects?|men|attackers?|intruders?)\s*(?:were|have been)?\s*(?:arrested|apprehended|detained)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return '';
}

function extractVerdict(text: string): string {
  const lower = text.toLowerCase();
  if (/found guilty|convicted|sentenced/i.test(lower)) return 'Guilty';
  if (/acquitted|found not guilty|charges? dropped/i.test(lower)) return 'Not guilty';
  if (/pending|awaiting trial|remanded/i.test(lower)) return 'Pending';
  return '';
}

function extractCaseStatus(text: string): string {
  const lower = text.toLowerCase();
  if (/\bresolved\b|case closed|convicted|sentenced/i.test(lower)) return 'Resolved';
  if (/\bunresolved\b|cold case|no arrest|unsolved/i.test(lower)) return 'Unresolved';
  if (/\bpending\b|under investigation|awaiting|remanded|bail/i.test(lower)) return 'Pending';
  return 'Unresolved';
}

function extractCasualties(text: string): string {
  const lower = text.toLowerCase();
  const killed = lower.match(/(\d+)\s*(?:killed|dead|deceased|died|murder)/);
  const injured = lower.match(/(\d+)\s*(?:injured|wounded|hospitalised|hospitalized)/);
  const parts: string[] = [];
  if (killed) parts.push(`${killed[1]} killed`);
  if (injured) parts.push(`${injured[1]} injured`);
  return parts.join(', ');
}

function extractUrls(text: string): string {
  const urls = text.match(/https?:\/\/[^\s,)]+/gi);
  return urls ? urls.join(', ') : '';
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
    const caseRefMatch = chunk.match(CASE_REF_RE);

    const date = dateMatch?.[1] ?? '';
    const location = locationMatch?.[1] ?? '';

    return [
      extractVictimName(chunk),         // victimName
      date,                             // dateOccurred
      '',                               // incidentType
      location,                         // location
      '',                               // province
      '',                               // severity
      chunk,                            // summary
      extractCasualties(chunk),         // casualties
      extractSuspectInfo(chunk),        // suspectName
      caseRefMatch?.[0] ?? '',          // courtCase
      extractVerdict(chunk),            // verdict
      extractCaseStatus(chunk),         // caseStatus
      extractUrls(chunk),              // sourceUrl
      '',                               // reporter
      '',                               // contactPhone
      '',                               // contactEmail
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

const FAKE_NEWS_SIGNALS_STRONG: string[] = [
  'share before they delete', 'they don\'t want you to know', 'mainstream media won\'t tell',
  'this is being suppressed', 'a friend told me', 'sent via whatsapp',
];

const FAKE_NEWS_SIGNALS_WEAK: string[] = [
  'forwarded as received', 'please share', 'wake up', 'unconfirmed but',
];

const SUSPICIOUS_DOMAINS: string[] = [
  'bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly',
];

function detectFakeNewsSignals(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const sig of FAKE_NEWS_SIGNALS_STRONG) {
    if (lower.includes(sig)) hits.push(sig);
  }
  for (const sig of FAKE_NEWS_SIGNALS_WEAK) {
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
  const hasStrongSignal = FAKE_NEWS_SIGNALS_STRONG.some(s => allText.toLowerCase().includes(s));
  if (hasStrongSignal || fakeSignals.length >= 2) {
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
// Province centroids for geocoding imported incidents onto the map
// ---------------------------------------------------------------------------

const PROVINCE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Gauteng': { lat: -26.27, lng: 28.11 },
  'Limpopo': { lat: -23.40, lng: 29.42 },
  'Mpumalanga': { lat: -25.57, lng: 30.30 },
  'North West': { lat: -26.66, lng: 25.28 },
  'Free State': { lat: -29.08, lng: 26.15 },
  'KwaZulu-Natal': { lat: -29.01, lng: 30.29 },
  'Eastern Cape': { lat: -32.00, lng: 26.50 },
  'Western Cape': { lat: -33.23, lng: 19.32 },
  'Northern Cape': { lat: -29.10, lng: 21.25 },
};

const SA_TOWN_COORDS: Record<string, { lat: number; lng: number }> = {
  'Johannesburg': { lat: -26.20, lng: 28.04 },
  'Pretoria': { lat: -25.75, lng: 28.19 },
  'Cape Town': { lat: -33.93, lng: 18.42 },
  'Durban': { lat: -29.86, lng: 31.02 },
  'Port Elizabeth': { lat: -33.96, lng: 25.60 },
  'Gqeberha': { lat: -33.96, lng: 25.60 },
  'Bloemfontein': { lat: -29.12, lng: 26.21 },
  'Polokwane': { lat: -23.91, lng: 29.45 },
  'Nelspruit': { lat: -25.47, lng: 30.97 },
  'Mbombela': { lat: -25.47, lng: 30.97 },
  'Kimberley': { lat: -28.74, lng: 24.77 },
  'Mahikeng': { lat: -25.87, lng: 25.64 },
  'Pietermaritzburg': { lat: -29.60, lng: 30.38 },
  'Rustenburg': { lat: -25.67, lng: 27.24 },
  'Centurion': { lat: -25.86, lng: 28.19 },
  'Soweto': { lat: -26.27, lng: 27.86 },
  'Benoni': { lat: -26.19, lng: 28.32 },
  'Bronkhorstspruit': { lat: -25.81, lng: 28.74 },
  'Musina': { lat: -22.34, lng: 30.04 },
  'Lephalale': { lat: -23.69, lng: 27.70 },
  'Mokopane': { lat: -24.19, lng: 29.01 },
  'Vaalwater': { lat: -24.30, lng: 28.10 },
  'Stellenbosch': { lat: -33.94, lng: 18.86 },
  'Paarl': { lat: -33.72, lng: 18.97 },
  'George': { lat: -33.96, lng: 22.46 },
  'Bredasdorp': { lat: -34.53, lng: 20.04 },
  'Ermelo': { lat: -26.53, lng: 29.99 },
  'Secunda': { lat: -26.51, lng: 29.17 },
  'Witbank': { lat: -25.88, lng: 29.23 },
  'Emalahleni': { lat: -25.88, lng: 29.23 },
  'Middelburg': { lat: -25.77, lng: 29.47 },
  'Upington': { lat: -28.45, lng: 21.27 },
  'Graaff-Reinet': { lat: -32.25, lng: 24.53 },
  'East London': { lat: -33.02, lng: 27.91 },
  'Mthatha': { lat: -31.59, lng: 28.78 },
  'Queenstown': { lat: -31.90, lng: 26.88 },
  'Potchefstroom': { lat: -26.72, lng: 27.10 },
  'Klerksdorp': { lat: -26.87, lng: 26.67 },
  'Welkom': { lat: -27.98, lng: 26.74 },
  'Kroonstad': { lat: -27.65, lng: 27.23 },
  'Newcastle': { lat: -27.76, lng: 29.93 },
  'Richards Bay': { lat: -28.78, lng: 32.04 },
  'Haenertsburg': { lat: -23.94, lng: 29.94 },
  'Mooinooi': { lat: -25.63, lng: 27.47 },
  'Bapsfontein': { lat: -26.03, lng: 28.52 },
  'Babsfontein': { lat: -26.03, lng: 28.52 },
  'Tweefontein': { lat: -25.95, lng: 29.20 },
  'Tzaneen': { lat: -23.83, lng: 30.16 },
  'Modjadjiskloof': { lat: -23.69, lng: 30.14 },
  'Louis Trichardt': { lat: -23.05, lng: 29.90 },
  'Makhado': { lat: -23.05, lng: 29.90 },
  'Thohoyandou': { lat: -22.95, lng: 30.48 },
  'Giyani': { lat: -23.31, lng: 30.72 },
  'Phalaborwa': { lat: -23.94, lng: 31.14 },
  'Burgersfort': { lat: -24.67, lng: 30.35 },
  'Lydenburg': { lat: -25.10, lng: 30.45 },
  'Mashishing': { lat: -25.10, lng: 30.45 },
  'Barberton': { lat: -25.79, lng: 31.05 },
  'Komatipoort': { lat: -25.44, lng: 31.94 },
  'White River': { lat: -25.33, lng: 31.01 },
  'Standerton': { lat: -26.95, lng: 29.24 },
  'Volksrust': { lat: -27.37, lng: 29.89 },
  'Bethlehem': { lat: -28.23, lng: 28.30 },
  'Harrismith': { lat: -28.27, lng: 29.13 },
  'Sasolburg': { lat: -26.81, lng: 27.83 },
  'Vereeniging': { lat: -26.67, lng: 27.93 },
  'Vanderbijlpark': { lat: -26.71, lng: 27.84 },
  'Springs': { lat: -26.25, lng: 28.44 },
  'Boksburg': { lat: -26.22, lng: 28.26 },
  'Germiston': { lat: -26.22, lng: 28.17 },
  'Kempton Park': { lat: -26.10, lng: 28.23 },
  'Randburg': { lat: -26.09, lng: 28.00 },
  'Sandton': { lat: -26.11, lng: 28.06 },
  'Roodepoort': { lat: -26.16, lng: 27.87 },
  'Krugersdorp': { lat: -26.08, lng: 27.77 },
  'Randfontein': { lat: -26.18, lng: 27.70 },
  'Carletonville': { lat: -26.36, lng: 27.40 },
  'Brits': { lat: -25.63, lng: 27.78 },
  'Hartbeespoort': { lat: -25.75, lng: 27.87 },
  'Sun City': { lat: -25.34, lng: 27.10 },
  'Lichtenburg': { lat: -26.15, lng: 26.16 },
  'Zeerust': { lat: -25.54, lng: 26.08 },
  'Vryburg': { lat: -26.96, lng: 24.73 },
  'Kuruman': { lat: -27.45, lng: 23.43 },
  'Springbok': { lat: -29.67, lng: 17.88 },
  'De Aar': { lat: -30.65, lng: 24.01 },
  'Cradock': { lat: -32.18, lng: 25.62 },
  'Grahamstown': { lat: -33.31, lng: 26.52 },
  'Makhanda': { lat: -33.31, lng: 26.52 },
  'King William\'s Town': { lat: -32.88, lng: 27.39 },
  'Bhisho': { lat: -32.85, lng: 27.44 },
  'Butterworth': { lat: -32.33, lng: 28.15 },
  'Kokstad': { lat: -30.55, lng: 29.42 },
  'Ladysmith': { lat: -28.56, lng: 29.78 },
  'Dundee': { lat: -28.17, lng: 30.23 },
  'Vryheid': { lat: -27.77, lng: 30.80 },
  'Empangeni': { lat: -28.75, lng: 31.90 },
  'Eshowe': { lat: -28.89, lng: 31.47 },
  'Stanger': { lat: -29.34, lng: 31.29 },
  'KwaDukuza': { lat: -29.34, lng: 31.29 },
  'Ballito': { lat: -29.54, lng: 31.22 },
  'Umhlanga': { lat: -29.73, lng: 31.08 },
  'Pinetown': { lat: -29.82, lng: 30.86 },
  'Chatsworth': { lat: -29.92, lng: 30.89 },
  'Port Shepstone': { lat: -30.74, lng: 30.45 },
  'Margate': { lat: -30.86, lng: 30.37 },
  'Hoedspruit': { lat: -24.35, lng: 30.97 },
  'Thabazimbi': { lat: -24.59, lng: 27.41 },
  'Bela-Bela': { lat: -24.88, lng: 28.29 },
  'Warmbaths': { lat: -24.88, lng: 28.29 },
  'Modimolle': { lat: -24.69, lng: 28.41 },
  'Nylstroom': { lat: -24.69, lng: 28.41 },
  'Soshanguve': { lat: -25.44, lng: 28.10 },
  'Mamelodi': { lat: -25.72, lng: 28.39 },
  'Atteridgeville': { lat: -25.77, lng: 28.08 },
  'Hammanskraal': { lat: -25.41, lng: 28.28 },
  'Siyabuswa': { lat: -25.12, lng: 29.05 },
  'Marble Hall': { lat: -24.97, lng: 29.28 },
  'Groblersdal': { lat: -25.17, lng: 29.40 },
  'Worcester': { lat: -33.65, lng: 19.45 },
  'Malmesbury': { lat: -33.46, lng: 18.73 },
  'Hermanus': { lat: -34.42, lng: 19.24 },
  'Knysna': { lat: -34.04, lng: 23.05 },
  'Mossel Bay': { lat: -34.18, lng: 22.14 },
  'Oudtshoorn': { lat: -33.59, lng: 22.20 },
  'Beaufort West': { lat: -32.35, lng: 22.58 },
  'Somerset West': { lat: -34.08, lng: 18.85 },
  'Strand': { lat: -34.11, lng: 18.83 },
  'Franschhoek': { lat: -33.91, lng: 19.12 },
  'Wellington': { lat: -33.64, lng: 19.01 },
  'Saldanha': { lat: -33.00, lng: 17.93 },
  'Langebaan': { lat: -33.09, lng: 18.02 },
  'Citrusdal': { lat: -32.59, lng: 19.01 },
  'Clanwilliam': { lat: -32.18, lng: 18.89 },
  'Plettenberg Bay': { lat: -34.05, lng: 23.37 },
  'Jeffreys Bay': { lat: -33.93, lng: 24.92 },
  'Coligny': { lat: -26.33, lng: 25.81 },
  'Delareyville': { lat: -26.68, lng: 25.46 },
  'Schweizer-Reneke': { lat: -27.19, lng: 25.32 },
  'Christiana': { lat: -27.91, lng: 25.17 },
  'Parys': { lat: -26.90, lng: 27.46 },
  'Heilbron': { lat: -27.28, lng: 27.97 },
  'Reitz': { lat: -27.80, lng: 28.43 },
  'Ficksburg': { lat: -28.88, lng: 27.88 },
  'Philippolis': { lat: -30.27, lng: 25.28 },
  'Trompsburg': { lat: -30.03, lng: 25.77 },
  'Aliwal North': { lat: -30.69, lng: 26.71 },
  'Sterkstroom': { lat: -31.57, lng: 26.53 },
  'Midrand': { lat: -25.99, lng: 28.13 },
  'Alexandra': { lat: -26.10, lng: 28.10 },
  'Tembisa': { lat: -25.99, lng: 28.23 },
  'Katlehong': { lat: -26.35, lng: 28.19 },
  'Thokoza': { lat: -26.36, lng: 28.15 },
  'Sebokeng': { lat: -26.57, lng: 27.83 },
  'Evaton': { lat: -26.53, lng: 27.85 },
  'Heidelberg': { lat: -26.50, lng: 28.36 },
  'Nigel': { lat: -26.43, lng: 28.47 },
  'Delmas': { lat: -26.15, lng: 28.68 },
  'Senekal': { lat: -28.32, lng: 27.63 },
  'Virginia': { lat: -28.10, lng: 26.87 },
  'Hennenman': { lat: -27.97, lng: 26.96 },
  'Vredefort': { lat: -27.00, lng: 27.35 },
  'Wolmaransstad': { lat: -27.20, lng: 25.97 },
  'Ottoshoop': { lat: -25.72, lng: 25.97 },
};

function geocodeIncident(town: string, province: string): { lat: number; lng: number } {
  const townKey = Object.keys(SA_TOWN_COORDS).find(k => k.toLowerCase() === town.toLowerCase());
  if (townKey) {
    const coords = SA_TOWN_COORDS[townKey]!;
    return { lat: coords.lat + (Math.random() - 0.5) * 0.05, lng: coords.lng + (Math.random() - 0.5) * 0.05 };
  }
  const provKey = Object.keys(PROVINCE_CENTROIDS).find(k => k.toLowerCase() === province.toLowerCase());
  if (provKey) {
    const coords = PROVINCE_CENTROIDS[provKey]!;
    return { lat: coords.lat + (Math.random() - 0.5) * 0.5, lng: coords.lng + (Math.random() - 0.5) * 0.5 };
  }
  return { lat: -28.5 + (Math.random() - 0.5) * 4, lng: 25.5 + (Math.random() - 0.5) * 6 };
}

function sortedRowToIncident(row: AISortedRow, index: number): MockIncident {
  const get = (label: string): string => row.public[label] ?? '';
  const town = get('Location / where');
  const province = get('Province');
  const coords = geocodeIncident(town, province);
  const dateOccurred = get('Date occurred') || new Date().toISOString().slice(0, 10);

  let deceased = 0;
  let injured = 0;
  const casualties = get('Casualties');
  const killedMatch = casualties.match(/(\d+)\s*killed/i);
  const injuredMatch = casualties.match(/(\d+)\s*injured/i);
  if (killedMatch?.[1]) deceased = parseInt(killedMatch[1], 10);
  if (injuredMatch?.[1]) injured = parseInt(injuredMatch[1], 10);

  const victimName = get('Victim name');
  const title = victimName
    ? `${victimName} — ${town || province || 'Unknown location'}`
    : get('Summary / notes').slice(0, 80) || `Imported incident #${index + 1}`;

  return {
    id: `imp-${Date.now().toString(36)}-${index.toString(36)}`,
    title,
    summary: get('Summary / notes'),
    module: row.module as MockIncident['module'],
    category: row.module,
    severity: row.severity as MockIncident['severity'],
    verification: 'v1_unverified' as MockIncident['verification'],
    locationTier: 'l3_area' as MockIncident['locationTier'],
    lng: coords.lng,
    lat: coords.lat,
    province: province,
    town: town,
    dateOccurred,
    dateReported: new Date().toISOString().slice(0, 10),
    sourceCount: 1,
    sources: [],
    tags: [],
    isSynthetic: false,
    casualties: deceased > 0 || injured > 0 ? { deceased, injured } : undefined,
    victimName: victimName || undefined,
    suspectName: row.confidential['Suspect name'] || undefined,
    incidentType: get('Incident type') || undefined,
    courtCase: row.confidential['Court case / docket'] || undefined,
    verdict: get('Verdict / outcome') || undefined,
    caseStatus: get('Case status') || undefined,
    sourceUrl: get('Source URL') || undefined,
    reporter: row.confidential['Reporter / contact'] || undefined,
    contactPhone: row.confidential['Phone number'] || undefined,
    contactEmail: row.confidential['Email address'] || undefined,
  };
}

function rawRowToIncident(
  row: string[],
  mapping: Record<TargetKey, number | -1>,
  index: number,
): MockIncident {
  const get = (key: TargetKey): string => {
    const idx = mapping[key];
    return idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  const allText = row.join(' ');
  const town = get('location');
  const province = get('province') || extractProvinceFromText(allText);
  const coords = geocodeIncident(town, province);
  const dateOccurred = get('dateOccurred') || new Date().toISOString().slice(0, 10);
  const summary = get('summary');
  const victimName = get('victimName');

  let deceased = 0;
  let injured = 0;
  const casualties = get('casualties');
  const killedMatch = casualties.match(/(\d+)\s*killed/i);
  const injuredMatch = casualties.match(/(\d+)\s*injured/i);
  if (killedMatch?.[1]) deceased = parseInt(killedMatch[1], 10);
  if (injuredMatch?.[1]) injured = parseInt(injuredMatch[1], 10);

  const title = victimName
    ? `${victimName} — ${town || province || 'Unknown location'}`
    : summary.slice(0, 80) || `Imported incident #${index + 1}`;

  const module = classifyModule(allText);
  const severity = classifySeverity(allText);

  return {
    id: `imp-${Date.now().toString(36)}-${index.toString(36)}`,
    title,
    summary,
    module: module as MockIncident['module'],
    category: module,
    severity: severity as MockIncident['severity'],
    verification: 'v1_unverified' as MockIncident['verification'],
    locationTier: 'l3_area' as MockIncident['locationTier'],
    lng: coords.lng,
    lat: coords.lat,
    province,
    town,
    dateOccurred,
    dateReported: new Date().toISOString().slice(0, 10),
    sourceCount: 1,
    sources: [],
    tags: [],
    isSynthetic: false,
    casualties: deceased > 0 || injured > 0 ? { deceased, injured } : undefined,
    victimName: victimName || undefined,
    suspectName: get('suspectName') || undefined,
    incidentType: get('incidentType') || undefined,
    courtCase: get('courtCase') || undefined,
    verdict: get('verdict') || undefined,
    caseStatus: get('caseStatus') || undefined,
    sourceUrl: get('sourceUrl') || undefined,
    reporter: get('reporter') || undefined,
    contactPhone: get('contactPhone') || undefined,
    contactEmail: get('contactEmail') || undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const addImportedIncidents = useAppStore((s) => s.addImportedIncidents);
  const importedIncidents = useAppStore((s) => s.importedIncidents);
  const clearImportedIncidents = useAppStore((s) => s.clearImportedIncidents);
  const deduplicateImportedIncidents = useAppStore((s) => s.deduplicateImportedIncidents);
  const getStorageEstimate = useAppStore((s) => s.getStorageEstimate);

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
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [skipIds, setSkipIds] = useState<Set<string>>(new Set());
  const [showDedupScan, setShowDedupScan] = useState(false);
  const [internalDupes, setInternalDupes] = useState<DuplicateMatch[]>([]);

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

  const runImport = () => {
    let newIncidents: MockIncident[];
    if (sorted && sortedRows.length > 0) {
      newIncidents = sortedRows.map((row, i) => sortedRowToIncident(row, i));
    } else if (dataRows.length > 0) {
      newIncidents = dataRows.map((row, i) => rawRowToIncident(row, mapping, i));
    } else {
      return;
    }

    // Split multi-incident entries before importing
    const towns = Object.keys(SA_TOWN_COORDS);
    const { result: splitIncidents, splitCount } = splitAllMultiIncidents(newIncidents, towns, geocodeIncident);
    if (splitCount > 0) {
      console.log(`[Import] Split ${splitCount} multi-incident entries → ${splitIncidents.length} total`);
    }

    const dupes = findDuplicates(splitIncidents, importedIncidents);
    if (dupes.length > 0) {
      setDuplicates(dupes);
      setSkipIds(new Set(dupes.map(d => d.newIncident.id)));
      return;
    }

    addImportedIncidents(splitIncidents);
    setImported(splitIncidents.length);
  };

  const confirmImportWithDupes = () => {
    let newIncidents: MockIncident[];
    if (sorted && sortedRows.length > 0) {
      newIncidents = sortedRows.map((row, i) => sortedRowToIncident(row, i));
    } else {
      newIncidents = dataRows.map((row, i) => rawRowToIncident(row, mapping, i));
    }
    const towns = Object.keys(SA_TOWN_COORDS);
    const { result: splitIncidents } = splitAllMultiIncidents(newIncidents, towns, geocodeIncident);
    const filtered = splitIncidents.filter(inc => !skipIds.has(inc.id));
    if (filtered.length > 0) addImportedIncidents(filtered);
    setImported(filtered.length);
    setDuplicates([]);
    setSkipIds(new Set());
  };

  const scanForInternalDupes = () => {
    const dupes = findInternalDuplicates(importedIncidents);
    setInternalDupes(dupes);
    setShowDedupScan(true);
  };

  const removeInternalDupe = (id: string) => {
    const updated = importedIncidents.filter(i => i.id !== id);
    clearImportedIncidents();
    if (updated.length > 0) addImportedIncidents(updated);
    setInternalDupes(prev => prev.filter(d => d.newIncident.id !== id && d.existing.id !== id));
  };

  const [cleanupReport, setCleanupReport] = useState<{ fixed: number; split: number; removed: number; deduplicated: number } | null>(null);
  const [dedupReport, setDedupReport] = useState<number | null>(null);

  const runDedup = () => {
    const removed = deduplicateImportedIncidents();
    setDedupReport(removed);
  };

  const cleanImportedData = () => {
    const towns = Object.keys(SA_TOWN_COORDS);
    let fixed = 0;
    let removed = 0;

    // Step 1: Split multi-incident entries using the robust splitter
    const { result: splitResult, splitCount } = splitAllMultiIncidents(
      importedIncidents, towns, geocodeIncident,
    );
    const splitTotal = splitResult.length - importedIncidents.length;

    // Step 2: Fix titles, casualties, and other data quality issues
    const cleaned: MockIncident[] = [];
    for (const inc of splitResult) {
      let needsFix = false;

      // Fix generic/garbage titles
      if (/^(?:\d+\s*(?:killed|dead)|[A-Z]\s+killed|unknown|imported incident)/i.test(inc.title)) {
        const nameMatch = inc.summary.match(/([A-Z][a-z]+(?:\s+(?:van|de|du|le|von)\s+)?(?:\s+[A-Z][a-z]+)+)/);
        if (nameMatch) {
          inc.title = `${nameMatch[0]} — ${inc.town || inc.province || 'Unknown location'}`;
        } else if (inc.summary.length > 10) {
          inc.title = inc.summary.slice(0, 80);
        }
        needsFix = true;
      }

      // Fix missing casualties: if summary mentions killing but no casualties set
      if (!inc.casualties && /\b(killed|murdered|dead|fatal|slain|shot dead)\b/i.test(inc.summary)) {
        const countMatch = inc.summary.match(/(\d+)\s*(?:killed|dead|deceased|murdered)/i);
        inc.casualties = { deceased: countMatch ? parseInt(countMatch[1]!, 10) : 1, injured: 0 };
        needsFix = true;
      }

      if (needsFix) fixed++;
      cleaned.push(inc);
    }

    clearImportedIncidents();
    if (cleaned.length > 0) addImportedIncidents(cleaned);
    const deduplicated = deduplicateImportedIncidents();
    setCleanupReport({ fixed, split: splitTotal, removed, deduplicated });
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
            {duplicates.length > 0 ? (
              <div>
                <div className="import-msg warning" style={{ marginBottom: 12 }}>
                  Found {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''} in the new data. Review below — uncheck any you want to keep.
                </div>
                <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Skip</th>
                        <th>New record</th>
                        <th>Matches existing</th>
                        <th>Score</th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {duplicates.map((d, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              type="checkbox"
                              checked={skipIds.has(d.newIncident.id)}
                              onChange={(e) => {
                                setSkipIds(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(d.newIncident.id);
                                  else next.delete(d.newIncident.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{d.newIncident.title}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.newIncident.dateOccurred} · {d.newIncident.town || d.newIncident.province}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{d.existing.title}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.existing.dateOccurred} · {d.existing.town || d.existing.province}</div>
                          </td>
                          <td style={{ fontSize: 12, fontWeight: 700, color: d.score >= 80 ? '#c53030' : '#d69e2e' }}>{d.score}%</td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.reasons.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={confirmImportWithDupes}>
                    Import {(sorted ? sortedRows.length : dataRows.length) - skipIds.size} records (skip {skipIds.size} duplicate{skipIds.size !== 1 ? 's' : ''})
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setSkipIds(new Set()); confirmImportWithDupes(); }}>
                    Import all anyway
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setDuplicates([]); setSkipIds(new Set()); }}>Cancel</button>
                </div>
              </div>
            ) : imported === null ? (
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

      {/* ── Stored incidents & storage ──────────────────────────────── */}
      {importedIncidents.length > 0 && (
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Stored Incidents</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" onClick={runDedup} style={{ fontSize: 11, color: '#d97706' }}>
                Remove Duplicates
              </button>
              <button className="btn btn-secondary" onClick={cleanImportedData} style={{ fontSize: 11, color: '#2563eb' }}>
                Split &amp; Clean
              </button>
              <button className="btn btn-secondary" onClick={scanForInternalDupes} style={{ fontSize: 11 }}>
                Scan for duplicates
              </button>
              <button className="btn btn-secondary" onClick={() => { if (confirm('Clear all imported incidents? This cannot be undone.')) clearImportedIncidents(); }} style={{ fontSize: 11, color: '#c53030' }}>
                Clear all
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{importedIncidents.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Incidents stored</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(getStorageEstimate().estimatedBytes)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Storage used</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: importedIncidents.filter(i => !i.isSynthetic).length > 0 ? '#38a169' : 'var(--text-muted)' }}>
                {importedIncidents.filter(i => !i.isSynthetic).length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>On map (real data)</div>
            </div>
          </div>
          {dedupReport !== null && (
            <div className="import-msg success" style={{ marginTop: 10 }}>
              {dedupReport > 0
                ? `Removed ${dedupReport} duplicate incidents. Total incidents now: ${importedIncidents.length}.`
                : 'No duplicates found — all incidents are unique.'}
              <button onClick={() => setDedupReport(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>Dismiss</button>
            </div>
          )}
          {cleanupReport && (
            <div className="import-msg success" style={{ marginTop: 10 }}>
              Data cleanup complete: {cleanupReport.fixed} titles/casualties fixed{cleanupReport.split > 0 ? `, ${cleanupReport.split} merged rows split into individual incidents` : ''}{cleanupReport.deduplicated > 0 ? `, ${cleanupReport.deduplicated} duplicates removed` : ''}.
              Total incidents now: {importedIncidents.length}.
              <button onClick={() => setCleanupReport(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>Dismiss</button>
            </div>
          )}
          {showDedupScan && (
            <div style={{ marginTop: 12 }}>
              {internalDupes.length === 0 ? (
                <div className="import-msg success">No duplicates found — data is clean.</div>
              ) : (
                <>
                  <div className="import-msg warning" style={{ marginBottom: 8 }}>
                    Found {internalDupes.length} potential duplicate pair{internalDupes.length !== 1 ? 's' : ''}. Remove the copy you don't need.
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Record A</th>
                          <th>Record B (potential copy)</th>
                          <th>Score</th>
                          <th>Reason</th>
                          <th style={{ width: 100 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {internalDupes.map((d, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{d.existing.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.existing.dateOccurred} · {d.existing.town || d.existing.province}</div>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{d.newIncident.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.newIncident.dateOccurred} · {d.newIncident.town || d.newIncident.province}</div>
                            </td>
                            <td style={{ fontSize: 12, fontWeight: 700, color: d.score >= 80 ? '#c53030' : '#d69e2e' }}>{d.score}%</td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.reasons.join(', ')}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-secondary" style={{ fontSize: 10, padding: '2px 6px', color: '#c53030' }} onClick={() => removeInternalDupe(d.newIncident.id)} title="Remove record B">
                                  Remove B
                                </button>
                                <button className="btn btn-secondary" style={{ fontSize: 10, padding: '2px 6px', color: '#c53030' }} onClick={() => removeInternalDupe(d.existing.id)} title="Remove record A">
                                  Remove A
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setShowDedupScan(false)}>Dismiss</button>
                  </div>
                </>
              )}
            </div>
          )}
          {getStorageEstimate().estimatedBytes > 20 * 1024 * 1024 && (
            <div className="import-msg warning" style={{ marginTop: 8 }}>
              Storage usage is high ({formatBytes(getStorageEstimate().estimatedBytes)}). Consider clearing old data or arranging more space before the next deploy.
            </div>
          )}
        </div>
      )}

      <div className="admin-note">
        <strong>How AI Sort works:</strong> The AI engine scans each row to (1) classify the incident module and severity, (2) extract names, phone numbers, email addresses, and case references from free text and move them to a confidential store visible only to admins, (3) produce a clean public summary safe for map display. <strong>PDF import:</strong> Text is extracted page-by-page and split into individual incident records using paragraph boundaries and structural markers (numbered lists, headings). Dates and locations are auto-detected where possible. In production, this runs through a server-side AI model (Groq/Gemini) with the same PII-separation guardrails. Images attached to submissions are individually approvable — only approved images are ever visible to the public. Originals of large files are kept in a 7-day retention queue; admins can mark specific files for permanent storage.
      </div>
    </div>
  );
}
