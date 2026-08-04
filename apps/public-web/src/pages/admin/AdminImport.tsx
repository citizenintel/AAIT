import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { useAppStore } from '../../stores/app-store';
import type { MockIncident } from '../../data/mock-incidents';
import {
  splitAllMultiIncidents,
  parseCasualties,
  stableHash,
  canonicalText,
  MAX_BATCH_FACTOR,
  MAX_SPLIT_FACTOR,
  type SplitBatchResult,
} from '../../lib/utils/incident-splitter';
import { SA_TOWN_COORDS, PROVINCE_CENTROIDS } from '../../lib/utils/sa-coordinates';
import { inferredFieldLabel } from '../../lib/utils/inferred-fields';
import { mockIncidentFingerprint } from '../../lib/utils/deduplicate';

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
  /**
   * Fraction of the row that was MAPPED, not an accuracy estimate. Named
   * `completeness` (it used to be `confidence`) because a percentage badge
   * labelled "confidence" over a deterministic regex pass reads to the operator
   * as an assessed judgement about whether the record is correct. It is not.
   */
  completeness: number;
  module: MockIncident['module'];
  severity: MockIncident['severity'];
  warnings: string[];
  flags: AIFlag[];
  /** Machine-derived field markers, carried onto the incident. See inferred-fields.ts. */
  inferredFields: string[];
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
  const dash = title.indexOf(' â€” ');
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
        // Unbalanced quote â€” force-close at row boundary
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

/**
 * Tokens that are never part of a person's name. Checked PER TOKEN, not just on
 * the first word â€” the old single-token check let "Free State", "High Court" and
 * "Doring Street" through into the victimName column.
 */
const NOT_A_NAME_TOKEN = new Set([
  'the', 'and', 'was', 'were', 'has', 'had', 'been', 'not', 'but', 'for', 'with',
  'from', 'that', 'this', 'have', 'are', 'his', 'her', 'their',
  'saps', 'police', 'water', 'municipality', 'metro', 'council', 'news',
  'hospital', 'dam', 'road', 'street', 'avenue', 'drive', 'lane', 'zone',
  'cape', 'town', 'city', 'province', 'provincial', 'department', 'eskom',
  'johannesburg', 'pretoria', 'polokwane', 'soweto', 'musina', 'bloemfontein',
  'durban', 'limpopo', 'gauteng', 'mpumalanga', 'kwazulu', 'natal',
  'western', 'eastern', 'northern', 'southern', 'free', 'north', 'south', 'east', 'west',
  'state', 'court', 'high', 'magistrate', 'magistrates', 'supreme', 'regional',
  'farm', 'plaas', 'smallholding', 'district', 'area', 'region',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'accused', 'suspect', 'suspects', 'victim', 'deceased', 'complainant', 'witness',
  'attack', 'murder', 'killed', 'shot', 'stabbed', 'robbery', 'unknown', 'incident',
  'traffic', 'residents', 'two', 'three', 'four', 'five',
]);

/** A candidate whose FULL text matches is never a person. */
const NOT_A_PERSON_PHRASE = new Set([
  'western cape', 'eastern cape', 'northern cape', 'free state', 'north west',
  'kwazulu natal', 'kwazulu-natal', 'south africa', 'high court',
  'magistrates court', 'supreme court', 'crime scene', 'police station',
]);

function looksLikePersonName(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  if (NOT_A_PERSON_PHRASE.has(trimmed.toLowerCase())) return false;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 5) return false;
  return !tokens.some(t => NOT_A_NAME_TOKEN.has(t.toLowerCase().replace(/[^a-z-]/g, '')));
}

/**
 * A victim name is only taken where the document EXPLICITLY labels one
 * ("the victim, Jan Botha", "Mr Jan Botha"). The old pattern 2 â€”
 * `<Capitalised phrase> was killed` â€” captured any capitalised phrase before a
 * violence verb, so a farm name, an organisation or a street became the named
 * murder victim of the record. Naming a person as a murder victim on no
 * evidence is the most consequential fabrication this file could make.
 *
 * Whatever this returns is machine-derived and is flagged 'victimName:from-text'.
 */
function extractVictimName(text: string): string {
  const patterns = [
    /(?:the\s+)?(?:victim|deceased|slain)\s*(?:was|is|,|:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/,
    /\b(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1] && looksLikePersonName(m[1])) return m[1];
  }
  return '';
}

/**
 * Counts only â€” never a name. Extracting a SUSPECT's name from prose and
 * publishing it beside a fabricated verdict is a defamation exposure, not a
 * data-quality question. The prose stays in the summary where a human can read
 * it; the machine does not name anyone as a suspect.
 */
function extractSuspectInfo(text: string): string {
  const m = text.match(/(\d+)\s*(?:suspects?|men|attackers?|intruders?)\s*(?:were|have been)?\s*(?:arrested|apprehended|detained)/i);
  return m ? m[0].trim() : '';
}

// extractVerdict and extractCaseStatus are DELETED.
//
// extractVerdict returned 'Guilty' on a bare substring match of "convicted" or
// "sentenced" anywhere in the chunk, with no tie to WHICH person the clause
// concerned, and wrote it to the verdict field beside a machine-extracted
// suspect name. extractCaseStatus returned 'Unresolved' as its default â€” a
// legal-status assertion the source never made.
//
// Neither can be evidenced from free text by substring matching. Both fields
// are now left blank for the PDF/DOCX path; the full chunk is still carried in
// the summary, so nothing is lost, and a human can fill them in.

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

  const numberedPattern = /(?:^|\n)(?:\d+[\.\)]\s|[-â€¢]\s|Incident\s*[:#]?\s*\d+)/i;
  const hasNumbered = numberedPattern.test(fullText);

  const chunks: string[] = [];

  if (hasNumbered) {
    const parts = fullText.split(/\n(?=\d+[\.\)]\s|[-â€¢]\s|Incident\s*[:#]?\s*\d+)/i);
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
      extractVictimName(chunk),         // victimName  (machine-derived â€” flagged)
      date,                             // dateOccurred (machine-derived â€” flagged)
      '',                               // incidentType
      location,                         // location    (machine-derived â€” flagged)
      '',                               // province
      '',                               // severity
      chunk,                            // summary     (verbatim document text)
      extractCasualties(chunk),         // casualties  (machine-derived â€” flagged)
      extractSuspectInfo(chunk),        // suspectName (counts only, never a name)
      caseRefMatch?.[0] ?? '',          // courtCase
      '',                               // verdict    â€” never machine-derived
      '',                               // caseStatus â€” never machine-derived
      extractUrls(chunk),               // sourceUrl
      '',                               // reporter
      '',                               // contactPhone
      '',                               // contactEmail
    ];
  });
}

/**
 * Column indices in the PDF/DOCX row shape above whose value is pattern-matched
 * out of prose rather than read from a labelled source field. The Raw Preview
 * marks these, and every incident built from such a row carries the matching
 * inferredFields entry.
 */
const DOC_DERIVED_KEYS: ReadonlySet<TargetKey> = new Set<TargetKey>([
  'victimName', 'dateOccurred', 'location', 'summary', 'casualties', 'suspectName',
]);

// ---------------------------------------------------------------------------
// DOCX text extraction
// ---------------------------------------------------------------------------

async function extractDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// ---------------------------------------------------------------------------
// AI sort engine (deterministic mock â€” server-side AI in production)
// ---------------------------------------------------------------------------

const SA_PHONE_RE = /(\+?27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const CASE_REF_RE = /\b(CAS|CASE|MAS|CR)\s?\d+[\/\-]\d+[\/\-]?\d*/gi;
const NAME_RE = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
/**
 * The ALL-CAPS-surname convention ("MOSTERT Susan") dominates this corpus and
 * NAME_RE â€” which demands mixed case in BOTH tokens â€” never matched it. The
 * redaction the splitter's safety depends on (its REDACTION_RE bail-out) was
 * therefore never triggered for the commonest name shape in the data, and the
 * splitter lifted those names straight into public titles.
 */
const CAPS_NAME_RE = /\b([A-Z]{2,})\s+([A-Z][a-z]{1,})\b/g;
/** Acronyms CAPS_NAME_RE must not mistake for a surname. */
const NOT_A_SURNAME_ACRONYM = new Set([
  'SAPS', 'ANC', 'NPA', 'EFF', 'DA', 'KZN', 'DNA', 'CCTV', 'SABC', 'NGO',
  'SANRAL', 'NSRI', 'IPID', 'HAWKS', 'SARS', 'SATU', 'TLU', 'AFRIFORUM',
  'SAPA', 'PPE', 'CAS', 'MAS', 'GPS', 'SUV', 'ATM', 'ID', 'SA',
]);
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

/** Whole-word keyword match. Unbounded `includes()` matched "shot" inside
 *  "gunshot" and "dead" inside "deadline". */
function hasKeyword(lower: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(lower);
}

/**
 * BLOCKER FIX. Previously initialised `best = 'ait'` with `bestScore = 0`, so a
 * record matching no keyword in any module was ASSERTED to be a Farm & Rural
 * incident. That single default is the mechanism behind the reported
 * "Farm & Rural 5237".
 *
 * Now: no match â†’ `null`, and the caller stores module 'unclassified' with an
 * inferredFields entry. Even a positive match is only a keyword guess, so it is
 * flagged too â€” the source never stated a module.
 */
function classifyModule(text: string): { module: MockIncident['module']; inferred: string } {
  const lower = text.toLowerCase();
  let best: MockIncident['module'] | null = null;
  let bestScore = 0;
  for (const [mod, kws] of Object.entries(MODULE_KEYWORDS)) {
    const score = kws.filter(k => hasKeyword(lower, k)).length;
    if (score > bestScore) { bestScore = score; best = mod as MockIncident['module']; }
  }
  if (!best) return { module: 'unclassified', inferred: 'module:unclassified' };
  return { module: best, inferred: 'module:keyword-guess' };
}

/**
 * BLOCKER FIX. Previously returned 'medium' for any text matching no keyword â€”
 * an assertion the source never made â€” and matched unbounded substrings in a
 * fixed critical-first order, so the word "killed" anywhere in the row
 * (including about a suspect, or in a court-outcome clause) yielded Critical.
 * That produced the reported "Critical 4910".
 *
 * Now: no match â†’ 'unassessed', which claims nothing. A match is still only a
 * keyword guess and is flagged as such.
 */
function classifySeverity(text: string): { severity: MockIncident['severity']; inferred: string } {
  const lower = text.toLowerCase();
  for (const [sev, kws] of Object.entries(SEVERITY_KEYWORDS)) {
    if (kws.some(k => hasKeyword(lower, k))) {
      return { severity: sev as MockIncident['severity'], inferred: 'severity:keyword-guess' };
    }
  }
  return { severity: 'unassessed', inferred: 'severity:unassessed' };
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

  // ALL-CAPS surname + given name ("MOSTERT Susan"). Without this pass the
  // dominant name shape in this corpus was never redacted.
  clean = clean.replace(CAPS_NAME_RE, (m, surname: string, given: string) => {
    if (NOT_A_SURNAME_ACRONYM.has(surname.toUpperCase())) return m;
    if (NOT_A_NAME.test(given)) return m;
    if (NOT_A_NAME_TOKEN.has(surname.toLowerCase()) || NOT_A_NAME_TOKEN.has(given.toLowerCase())) return m;
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
      flags.push({ type: 'gap', field: f.label, message: `No data provided for "${f.label}" â€” left blank` });
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

  const inferredFields: string[] = [];

  const { module, inferred: moduleInferred } = classifyModule(allText);
  const { severity, inferred: severityInferred } = classifySeverity(allText);
  inferredFields.push(moduleInferred, severityInferred);

  // Labels say plainly that these are guesses, not readings.
  publicFields['Module (keyword guess)'] = module;
  publicFields['Severity (keyword guess)'] = severity;

  const mappedProvince = get('province');
  const province = mappedProvince || extractProvinceFromText(allText);
  if (province) publicFields['Province'] = province;
  // A province found by scanning the whole row can just as easily be a
  // newspaper name, a court name or a suspect's home province. Flag it so it is
  // not mistaken for the value of a mapped source column.
  if (!mappedProvince && province) inferredFields.push('province:from-text');

  if (extracted.length > 0) {
    warnings.push(`${extracted.length} PII item${extracted.length > 1 ? 's' : ''} extracted and moved to confidential`);
  }
  if (!get('dateOccurred')) {
    warnings.push('No date detected â€” review required');
    // This message is now TRUE: the builders below leave dateOccurred empty.
    // Previously the UI said "left blank" while the code stamped today's date.
    flags.push({ type: 'gap', field: 'Date', message: 'No date found in submission â€” left blank for admin review' });
    inferredFields.push('date:missing');
  }
  if (!province) {
    warnings.push('No province detected â€” manual assignment needed');
    flags.push({ type: 'gap', field: 'Province', message: 'Province could not be determined â€” left blank' });
  }
  if (!get('location')) inferredFields.push('town:missing');

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
      flags.push({ type: 'inaccurate', field: 'Date', message: `Date "${dateVal}" is in the future â€” likely incorrect` });
    }
  }

  if (summary.length < 15 && summary.length > 0) {
    flags.push({ type: 'suspicious', field: 'Summary', message: 'Very short description â€” may lack useful detail' });
  }

  // NOT a confidence score. It measures how much of the row was MAPPED â€” it
  // says nothing about whether any value is accurate. Labelled accordingly
  // everywhere it is displayed.
  const mappedFields = Object.values(mapping).filter(v => v >= 0).length;
  const completeness = Math.min(100, Math.round((mappedFields / TARGET_FIELDS.length) * 80 + (province ? 10 : 0) + (get('dateOccurred') ? 10 : 0)));

  return { public: publicFields, confidential: confidentialFields, rawRow: row, completeness, module, severity, warnings, flags, inferredFields };
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
  unclassified: { label: 'Unclassified', colour: '#94a3b8' },
};

const SEV_COLOURS: Record<string, string> = {
  critical: '#c53030', high: '#ed8936', medium: '#d69e2e', low: '#38a169', informational: '#718096',
  unassessed: '#94a3b8',
};

// Province centroids and town coords imported from sa-coordinates.ts

/**
 * BLOCKER FIX. The old final fallback returned
 *   { lat: -28.5 + (Math.random() - 0.5) * 4, lng: 25.5 + (Math.random() - 0.5) * 6 }
 * â€” a random point spanning roughly 440 km x 600 km of South Africa â€” whenever
 * both town and province were unresolved, and plotted it on the public map as
 * the incident's position. It never returned null, so the splitter's
 * null-tolerant GeocodeFn contract and its coords:unresolved flag could never
 * fire from this call site.
 *
 * It also added undisclosed Math.random() jitter to RESOLVED coordinates, so the
 * same record landed somewhere different on every import â€” a record's position
 * was not even reproducible from its own source row.
 *
 * Now: exact gazetteer/centroid values, no jitter, and null when unresolved.
 * `resolution` tells the caller how precise the answer is so it can be flagged.
 */
type GeocodeResult = { lat: number; lng: number; resolution: 'town' | 'province' };

function geocodeIncident(town: string, province: string): GeocodeResult | null {
  if (town) {
    const townKey = Object.keys(SA_TOWN_COORDS).find(k => k.toLowerCase() === town.toLowerCase());
    if (townKey) {
      const coords = SA_TOWN_COORDS[townKey]!;
      return { lat: coords.lat, lng: coords.lng, resolution: 'town' };
    }
  }
  if (province) {
    const provKey = Object.keys(PROVINCE_CENTROIDS).find(k => k.toLowerCase() === province.toLowerCase());
    if (provKey) {
      const coords = PROVINCE_CENTROIDS[provKey]!;
      return { lat: coords.lat, lng: coords.lng, resolution: 'province' };
    }
  }
  return null;
}

/** Adapter matching the splitter's GeocodeFn contract (null == unresolved). */
const geocodeForSplitter = (town: string, province: string): { lat: number; lng: number } | null => {
  const r = geocodeIncident(town, province);
  return r ? { lat: r.lat, lng: r.lng } : null;
};

/**
 * Build the coordinate + provenance pair for an imported record.
 * An unresolved location yields NaN â€” a value every consumer can test with
 * Number.isFinite â€” rather than a plausible-looking point somewhere in the
 * Free State. MapView skips non-finite positions; the record still exists.
 */
function resolvePosition(town: string, province: string): { lat: number; lng: number; flag: string } {
  const geo = geocodeIncident(town, province);
  if (!geo) return { lat: NaN, lng: NaN, flag: 'coords:unresolved' };
  return {
    lat: geo.lat,
    lng: geo.lng,
    flag: geo.resolution === 'town' ? 'coords:from-town' : 'coords:from-province',
  };
}

/**
 * Explicit casualty digits from a casualties CELL. Each figure is independently
 * optional: a cell reading "2 injured" says nothing about fatalities, so
 * `deceased` stays undefined rather than being written as a confirmed 0.
 */
function parseCasualtyCell(cell: string): { deceased?: number; injured?: number } | undefined {
  const killedMatch = cell.match(/(\d+)\s*killed/i);
  const injuredMatch = cell.match(/(\d+)\s*injured/i);
  if (!killedMatch && !injuredMatch) return undefined;
  const out: { deceased?: number; injured?: number } = {};
  if (killedMatch?.[1]) out.deceased = parseInt(killedMatch[1], 10);
  if (injuredMatch?.[1]) out.injured = parseInt(injuredMatch[1], 10);
  return out;
}

/**
 * Title for an imported record.
 *
 * A victimName that came from a MAPPED SOURCE COLUMN is source-stated and safe
 * to use. Everything else falls back to a structural title stamped with a hash
 * of the record's own text: unique (so it cannot collide in
 * incidentFingerprint) and honest (it claims nothing the source did not say).
 * The old fallback â€” `summary.slice(0, 80)` â€” republished raw, possibly
 * un-redacted source text as a public title.
 */
function buildImportTitle(
  sourceVictimName: string,
  town: string,
  province: string,
  summary: string,
  dateOccurred: string,
): { title: string; structural: boolean } {
  const place = town || province || 'Unknown location';
  if (sourceVictimName) return { title: `${sourceVictimName} â€” ${place}`, structural: false };
  const stamp = stableHash(canonicalText(summary || `${place}|${dateOccurred}`));
  return {
    title: `Unidentified incident â€” ${place}${dateOccurred ? ` â€” ${dateOccurred}` : ''} Â· entry ${stamp}`,
    structural: true,
  };
}

/** Options shared by both builders. */
interface BuildOptions {
  /** True when rows came from a PDF/DOCX, i.e. every field is pattern-matched. */
  documentDerived: boolean;
}

function sortedRowToIncident(row: AISortedRow, index: number, opts: BuildOptions): MockIncident {
  const get = (label: string): string => row.public[label] ?? '';
  const town = get('Location / where');
  const province = get('Province');
  const pos = resolvePosition(town, province);

  // BLOCKER FIX. There is no `|| new Date()` fallback any more. A source that
  // states no date leaves this blank; today's date is not evidence about when
  // anything happened, and it drove timelines and the splitter's date logic.
  const dateOccurred = get('Date occurred');

  const victimName = get('Victim name');
  const summary = get('Summary / notes');
  const { title, structural } = buildImportTitle(victimName, town, province, summary, dateOccurred);

  const inferredFields = new Set<string>(row.inferredFields);
  inferredFields.add(pos.flag);
  if (structural) inferredFields.add('title:structural');
  if (!dateOccurred) inferredFields.add('date:missing');
  if (opts.documentDerived) {
    inferredFields.add('summary:from-document');
    if (victimName) inferredFields.add('victimName:from-text');
    if (get('Casualties')) inferredFields.add('casualties:from-text');
  }

  const sources: string[] = [];
  const sourceUrl = get('Source URL');
  if (sourceUrl) sources.push(sourceUrl);

  return {
    id: `imp-${Date.now().toString(36)}-${index.toString(36)}`,
    title,
    summary,
    module: row.module,
    category: row.module,
    severity: row.severity,
    // 'v1_unverified' is not a member of VerificationState — the cast hid that, so
    // these records carried a verification value no lookup could resolve and the
    // badge rendered blank rather than saying 'unverified'.
    verification: 'v0_unverified',
    locationTier: 'l3_area' as MockIncident['locationTier'],
    lng: pos.lng,
    lat: pos.lat,
    province: province,
    town: town,
    dateOccurred,
    dateReported: new Date().toISOString().slice(0, 10),
    // Never claim a source that is not there.
    sourceCount: sources.length,
    sources,
    tags: [],
    isSynthetic: false,
    casualties: parseCasualtyCell(get('Casualties')),
    victimName: victimName || undefined,
    suspectName: row.confidential['Suspect name'] || undefined,
    incidentType: get('Incident type') || undefined,
    courtCase: row.confidential['Court case / docket'] || undefined,
    verdict: get('Verdict / outcome') || undefined,
    caseStatus: get('Case status') || undefined,
    sourceUrl: sourceUrl || undefined,
    reporter: row.confidential['Reporter / contact'] || undefined,
    contactPhone: row.confidential['Phone number'] || undefined,
    contactEmail: row.confidential['Email address'] || undefined,
    inferredFields: [...inferredFields],
    // Everything on this path carries at least one machine-derived field
    // (module and severity are always keyword guesses), so nothing from an
    // import is publishable until an editor has looked at it.
    needsReview: true,
  };
}

function rawRowToIncident(
  row: string[],
  mapping: Record<TargetKey, number | -1>,
  index: number,
  opts: BuildOptions,
): MockIncident {
  const get = (key: TargetKey): string => {
    const idx = mapping[key];
    return idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  const allText = row.join(' ');
  const town = get('location');
  const mappedProvince = get('province');
  const province = mappedProvince || extractProvinceFromText(allText);
  const pos = resolvePosition(town, province);

  // BLOCKER FIX (second call site). Same reasoning as above: no date fallback.
  const dateOccurred = get('dateOccurred');
  const summary = get('summary');
  const victimName = get('victimName');
  const { title, structural } = buildImportTitle(victimName, town, province, summary, dateOccurred);

  const { module, inferred: moduleInferred } = classifyModule(allText);
  const { severity, inferred: severityInferred } = classifySeverity(allText);

  const inferredFields = new Set<string>([moduleInferred, severityInferred, pos.flag]);
  if (structural) inferredFields.add('title:structural');
  if (!dateOccurred) inferredFields.add('date:missing');
  if (!town) inferredFields.add('town:missing');
  if (!mappedProvince && province) inferredFields.add('province:from-text');
  if (opts.documentDerived) {
    inferredFields.add('summary:from-document');
    if (victimName) inferredFields.add('victimName:from-text');
    if (get('casualties')) inferredFields.add('casualties:from-text');
  }

  const sources: string[] = [];
  const sourceUrl = get('sourceUrl');
  if (sourceUrl) sources.push(sourceUrl);

  return {
    id: `imp-${Date.now().toString(36)}-${index.toString(36)}`,
    title,
    summary,
    module,
    category: module,
    severity,
    // 'v1_unverified' is not a member of VerificationState — the cast hid that, so
    // these records carried a verification value no lookup could resolve and the
    // badge rendered blank rather than saying 'unverified'.
    verification: 'v0_unverified',
    locationTier: 'l3_area' as MockIncident['locationTier'],
    lng: pos.lng,
    lat: pos.lat,
    province,
    town,
    dateOccurred,
    dateReported: new Date().toISOString().slice(0, 10),
    sourceCount: sources.length,
    sources,
    tags: [],
    isSynthetic: false,
    casualties: parseCasualtyCell(get('casualties')),
    victimName: victimName || undefined,
    suspectName: get('suspectName') || undefined,
    incidentType: get('incidentType') || undefined,
    courtCase: get('courtCase') || undefined,
    verdict: get('verdict') || undefined,
    caseStatus: get('caseStatus') || undefined,
    sourceUrl: sourceUrl || undefined,
    reporter: get('reporter') || undefined,
    contactPhone: get('contactPhone') || undefined,
    contactEmail: get('contactEmail') || undefined,
    inferredFields: [...inferredFields],
    needsReview: true,
  };
}

// ---------------------------------------------------------------------------
// Split safety rails (design part F)
// ---------------------------------------------------------------------------

/** A split that has been COMPUTED but NOT committed. Held in state until the
 *  operator confirms it. Nothing here has touched the store. */
interface SplitPreview {
  /** Hash of the id list the plan was computed against â€” detects ANY change,
   *  not just one that alters the record count. */
  setKey: string;
  /** importedIncidents.length when the plan was computed. */
  before: number;
  after: number;
  factor: number;
  /** Source rows that produced more than one record. */
  splitCount: number;
  /** Rows the splitter refused to touch because they are already split products. */
  alreadySplit: number;
  /** Rows that hit MAX_SPLIT_FACTOR; their tail is kept as one record, never dropped. */
  capped: number;
  /** Chunks that failed the evidence gate and were folded back into a neighbour. */
  mergedFragments: number;
  worstOffenders: SplitBatchResult['worstOffenders'];
  /** The already-computed output, reused on confirm so geocoding is not re-rolled. */
  result: MockIncident[];
}

/**
 * Identity of a whole stored set â€” every id, in order, hashed.
 *
 * The old staleness guard compared record COUNTS only, so a same-length change
 * between preview and apply (one record removed and one added) went undetected
 * and the stale plan was written wholesale, discarding the intervening change.
 */
function incidentSetKey(incidents: MockIncident[]): string {
  return stableHash(incidents.map(i => i.id).join('|')) + `:${incidents.length}`;
}

/** A deletion that has been COMPUTED but NOT committed. */
interface DedupPreview {
  setKey: string;
  total: number;
  wouldRemove: number;
  /** Exactly which records would be deleted, and what they collide with. */
  pairs: { keep: MockIncident; remove: MockIncident; fingerprint: string }[];
}

/**
 * Work out precisely which records `deduplicateImportedIncidents` would delete,
 * using the same fingerprint rule the store uses, so what the operator is shown
 * is what actually happens.
 */
function computeDedupPreview(incidents: MockIncident[]): DedupPreview {
  const seenFp = new Map<string, MockIncident>();
  const seenId = new Set<string>();
  const pairs: DedupPreview['pairs'] = [];
  for (const inc of incidents) {
    if (seenId.has(inc.id)) continue;
    seenId.add(inc.id);
    const fp = mockIncidentFingerprint(inc);
    const first = fp ? seenFp.get(fp) : undefined;
    if (first && first.id !== inc.id) {
      pairs.push({ keep: first, remove: inc, fingerprint: fp });
      continue;
    }
    if (fp && !seenFp.has(fp)) seenFp.set(fp, inc);
  }
  return {
    setKey: incidentSetKey(incidents),
    total: incidents.length,
    wouldRemove: pairs.length,
    pairs,
  };
}

/** Operator-facing refusal text for a batch that blew through MAX_BATCH_FACTOR. */
function buildRefusalMessage(batch: SplitBatchResult, context: string): string {
  const lines: string[] = [
    `REFUSED â€” nothing was written. ${context} would take ${batch.originalTotal} record${batch.originalTotal === 1 ? '' : 's'} to ${batch.newTotal} (${batch.factor.toFixed(2)}Ã—), above the ${MAX_BATCH_FACTOR}Ã— safety limit.`,
  ];
  if (batch.capped > 0) {
    lines.push(`${batch.capped} row${batch.capped === 1 ? '' : 's'} also hit the per-row cap of ${MAX_SPLIT_FACTOR}.`);
  }
  lines.push('A legitimate multi-incident sheet does not triple. Review these source rows by hand:');
  for (const o of batch.worstOffenders) {
    lines.push(`â€¢ ${o.id} â†’ ${o.childCount} records${o.capped ? ' (capped)' : ''}: ${o.excerpt}â€¦`);
  }
  return lines.join('\n');
}

/** What the "Split & Clean" / "Clean only" action actually did. Every number
 *  shown to the operator comes from here â€” no figure is estimated. */
interface CleanupReport {
  action: 'split-clean' | 'clean-only';
  before: number;
  after: number;
  /** Source rows that fanned out into more than one record. */
  rowsSplit: number;
  /** Extra records produced by splitting (after âˆ’ before). */
  recordsAdded: number;
  /** Fragments the splitter merged back into a neighbour instead of promoting. */
  fragmentsMerged: number;
  /** Records skipped by the idempotency guard because they were already split. */
  alreadySplit: number;
  capped: number;
  titlesFixed: number;
  casualtiesFilled: number;
  unchanged: number;
  /** Cleaning never deletes. Always 0 â€” kept explicit so the report cannot mislead. */
  removed: number;
}

/** What an import actually staged, including anything the store rejected. */
interface ImportReport {
  fileName: string;
  sourceRows: number;
  rowsSplit: number;
  recordsAdded: number;
  fragmentsMerged: number;
  capped: number;
  offered: number;
  skippedByOperator: number;
  staged: number;
  /** Offered records the store refused as duplicates of what was already there. */
  rejectedByStore: number;
  /**
   * Offered records that REPLACED a stored record with the same id. The store
   * overwrites in place, leaving the array length unchanged, so a length-delta
   * calculation reported these as "not added" â€” the exact opposite of what
   * happened, and it hid the fact that any editor changes to those records were
   * discarded.
   */
  replacedInStore: number;
  storedTotal: number;
  /** True when the operator imported without splitting after an F5 refusal. */
  unsplit?: boolean;
}

const GARBAGE_TITLE_RE = /^(?:\d+\s*(?:killed|dead)|[A-Z]\s+killed|unknown|imported incident)/i;

// NAME_IN_SUMMARY_RE is DELETED. It was a bare two-capitalised-word pattern with
// no stopword filtering at all, and its match was used to build the record's
// public title â€” so "Free State", "High Court" and "Doring Street" became the
// named subject of an incident. A title is a published claim about who this
// record is about; it is not somewhere to guess.
//
// A broken title is now replaced by a structural one stamped with a hash of the
// record's own text: it asserts nothing, and (unlike a bare place+date title) it
// cannot collide with a sibling in incidentFingerprint and be deleted as a
// duplicate.

interface CleanOutcome {
  incidents: MockIncident[];
  titlesFixed: number;
  casualtiesFilled: number;
  unchanged: number;
}

/**
 * Repair obviously-broken titles and fill in casualty figures that are stated
 * explicitly in the summary text.
 *
 * Three properties this function must keep:
 *  1. It NEVER mutates its input. The store is immer-backed and deep-frozen;
 *     assigning to a stored object throws in strict mode (design part F2).
 *  2. It is idempotent. A field is only written when the new value differs from
 *     the old, so running it twice changes nothing and reports nothing.
 *  3. It NEVER invents a number. A summary that says someone was killed without
 *     saying how many yields no casualty figure at all (design part E1).
 *  4. It emits exactly one record per input record. Nothing is dropped.
 */
function cleanIncidents(source: MockIncident[]): CleanOutcome {
  const incidents: MockIncident[] = [];
  let titlesFixed = 0;
  let casualtiesFilled = 0;
  let unchanged = 0;

  for (const src of source) {
    const inc: MockIncident = {
      ...src,
      casualties: src.casualties ? { ...src.casualties } : undefined,
      inferredFields: src.inferredFields ? [...src.inferredFields] : undefined,
    };
    let changed = false;

    if (GARBAGE_TITLE_RE.test(inc.title)) {
      // No name guessing, and no echoing raw source text. A structural title
      // stamped with a hash of the record's own summary asserts nothing and is
      // unique, so incidentFingerprint cannot confuse two distinct records.
      const place = inc.town || inc.province || 'Unknown location';
      const stamp = stableHash(canonicalText(inc.summary || `${inc.id}|${place}`));
      const nextTitle = `Unidentified incident â€” ${place}${inc.dateOccurred ? ` â€” ${inc.dateOccurred}` : ''} Â· entry ${stamp}`;
      if (nextTitle !== inc.title) {
        inc.title = nextTitle;
        inc.inferredFields = [...new Set([...(inc.inferredFields ?? []), 'title:structural'])];
        inc.needsReview = true;
        titlesFixed++;
        changed = true;
      }
    }

    // Only ever FILL a missing figure, and only from an explicit digit in the
    // text. An existing figure came from the source column and is authoritative.
    if (!inc.casualties) {
      const parsed = parseCasualties(inc.summary);
      if (parsed && ((parsed.deceased ?? 0) > 0 || (parsed.injured ?? 0) > 0)) {
        inc.casualties = parsed;
        inc.inferredFields = [...new Set([...(inc.inferredFields ?? []), 'casualties:from-summary'])];
        inc.needsReview = true;
        casualtiesFilled++;
        changed = true;
      }
    }

    if (!changed) unchanged++;
    incidents.push(inc);
  }

  return { incidents, titlesFixed, casualtiesFilled, unchanged };
}

// ---------------------------------------------------------------------------
// Recovery diagnostics (design part D)
// ---------------------------------------------------------------------------

/** Legacy accreting split ids look like `imp-x-y-s0-s1`. Current ones carry
 *  provenance and are read directly. */
const LEGACY_SPLIT_SUFFIX_RE = /(-s[0-9a-z]+(?:\.\d+)?)+$/i;

function lineageRootId(inc: MockIncident): string {
  if (inc.splitFrom?.rootId) return inc.splitFrom.rootId;
  return inc.id.replace(LEGACY_SPLIT_SUFFIX_RE, '') || inc.id;
}

interface Inventory {
  total: number;
  distinctRoots: number;
  splitProducts: number;
  legacySplitProducts: number;
  needsReview: number;
  cappedProducts: number;
  withoutCoordinates: number;
  topParents: { rootId: string; count: number }[];
  /**
   * Sum of every EXPLICITLY-STATED fatality figure currently stored. Records
   * whose source stated no figure contribute nothing â€” they are counted
   * separately in `withoutStatedDeceased` so the operator can see how much of
   * the set the total does not cover.
   */
  totalDeceased: number;
  /** Records that state no fatality figure at all. */
  withoutStatedDeceased: number;
  /** Count of every inferredFields marker across the set, by marker. */
  inferredCounts: { key: string; count: number }[];
  /** Records carrying at least one machine-derived field. */
  withInferredFields: number;
}

function buildInventory(incidents: MockIncident[]): Inventory {
  const byRoot = new Map<string, number>();
  let splitProducts = 0;
  let legacySplitProducts = 0;
  let needsReview = 0;
  let cappedProducts = 0;
  let withoutCoordinates = 0;
  let totalDeceased = 0;
  let withoutStatedDeceased = 0;
  let withInferredFields = 0;
  const inferred = new Map<string, number>();

  for (const inc of incidents) {
    const root = lineageRootId(inc);
    byRoot.set(root, (byRoot.get(root) ?? 0) + 1);
    if (inc.splitFrom) splitProducts++;
    else if (root !== inc.id) legacySplitProducts++;
    if (inc.needsReview) needsReview++;
    if (inc.splitFrom?.capped) cappedProducts++;
    if (!Number.isFinite(inc.lat) || !Number.isFinite(inc.lng)) withoutCoordinates++;
    // Only explicitly-stated figures are summed. `?? 0` would let "unknown"
    // masquerade as "confirmed none" inside the published total.
    if (typeof inc.casualties?.deceased === 'number') totalDeceased += inc.casualties.deceased;
    else withoutStatedDeceased++;
    if (inc.inferredFields?.length) {
      withInferredFields++;
      for (const f of inc.inferredFields) inferred.set(f, (inferred.get(f) ?? 0) + 1);
    }
  }

  return {
    total: incidents.length,
    distinctRoots: byRoot.size,
    splitProducts,
    legacySplitProducts,
    needsReview,
    cappedProducts,
    withoutCoordinates,
    totalDeceased,
    withoutStatedDeceased,
    withInferredFields,
    inferredCounts: [...inferred.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    topParents: [...byRoot.entries()]
      .map(([rootId, count]) => ({ rootId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

/** Write the current imported set to a JSON file on the operator's machine.
 *  This is the audit trail for how any published figure was produced, and it is
 *  the precondition for the reset below. */
function downloadSnapshot(incidents: MockIncident[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `incidents-snapshot-${stamp}.json`;
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), count: incidents.length, incidents }, null, 2)],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
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
  const replaceImportedIncidents = useAppStore((s) => s.replaceImportedIncidents);
  const deduplicateImportedIncidents = useAppStore((s) => s.deduplicateImportedIncidents);
  const getStorageEstimate = useAppStore((s) => s.getStorageEstimate);

  /**
   * The public-side ReviewQueueBanner links here with #review-queue. That block
   * sits far below the upload form, the mapping table and the import report, so
   * without this the user lands at the top of a 3000-line page and has to hunt
   * for the control they were just told to press. The block renders
   * conditionally, so retry briefly rather than assuming it exists on frame 1.
   */
  useEffect(() => {
    if (window.location.hash !== '#review-queue') return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById('review-queue');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid #d69e2e';
        window.setTimeout(() => { el.style.outline = ''; }, 2500);
        window.clearInterval(timer);
      } else if (++tries > 20) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

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
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  /** Batch computed by runImport, held across the duplicate-review step so the
   *  operator confirms exactly the records they were shown. */
  const [pendingBatch, setPendingBatch] = useState<SplitBatchResult | null>(null);
  /** Source rows held after an F5 refusal, offered for import WITHOUT splitting. */
  const [unsplitOffer, setUnsplitOffer] = useState<MockIncident[] | null>(null);
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
    setImported(null); setImportReport(null); setPendingBatch(null); setUnsplitOffer(null);
    setDuplicates([]); setSkipIds(new Set()); setFileName('');
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
          setError('Failed to read PDF â€” the file may be encrypted or corrupted.');
          setPdfExtracting(false);
        });
      return;
    }

    if (['xlsx', 'xls'].includes(ext)) {
      setNotice('Spreadsheet detected â€” XLS/XLSX files are parsed server-side (SheetJS). Export as CSV for local preview and column mapping.');
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
          setError('Failed to read document â€” the file may be corrupted or password-protected.');
          setPdfExtracting(false);
        });
      return;
    }
    if (ext === 'doc') {
      setNotice('Legacy .doc format detected â€” please save as .docx or .pdf and re-upload for automatic extraction.');
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
    // No artificial delay. `setTimeout(800 + Math.random() * 600)` existed only
    // to make a deterministic regex pass feel like an assessed AI judgement.
    // Dressing up a rules engine as a model is how the operator ends up
    // trusting a keyword guess.
    await Promise.resolve();

    const results = dataRows.map(row => aiSortRow(row, mapping));
    setSortedRows(results);
    setSorted(true);
    setSorting(false);
  }, [dataRows, mapping]);

  const buildIncidentsFromSource = (): MockIncident[] | null => {
    // `isPdf` is set for PDF and DOCX. Every field on that path is
    // pattern-matched out of prose, so each record is marked as such.
    const opts: BuildOptions = { documentDerived: isPdf };
    if (sorted && sortedRows.length > 0) return sortedRows.map((row, i) => sortedRowToIncident(row, i, opts));
    if (dataRows.length > 0) return dataRows.map((row, i) => rawRowToIncident(row, mapping, i, opts));
    return null;
  };

  /** Stage a computed batch and report precisely what the store accepted. */
  const commitImport = (
    batch: SplitBatchResult,
    toStage: MockIncident[],
    skippedByOperator: number,
    unsplit = false,
  ) => {
    // Identify outcomes by ID, not by array length. The store OVERWRITES on an
    // id match, so a length delta cannot tell "replaced an existing record"
    // apart from "refused as a duplicate" â€” and it reported the former as the
    // latter, stating the opposite of what happened.
    const beforeIds = new Set(useAppStore.getState().importedIncidents.map(i => i.id));
    if (toStage.length > 0) addImportedIncidents(toStage);
    const afterState = useAppStore.getState().importedIncidents;
    const afterIds = new Set(afterState.map(i => i.id));

    let staged = 0;
    let replacedInStore = 0;
    let rejectedByStore = 0;
    for (const inc of toStage) {
      if (beforeIds.has(inc.id)) replacedInStore++;
      else if (afterIds.has(inc.id)) staged++;
      else rejectedByStore++;
    }

    setImported(staged);
    setImportReport({
      fileName,
      sourceRows: batch.originalTotal,
      rowsSplit: batch.splitCount,
      recordsAdded: batch.newTotal - batch.originalTotal,
      fragmentsMerged: batch.mergedFragments,
      capped: batch.capped,
      offered: toStage.length,
      skippedByOperator,
      staged,
      rejectedByStore,
      replacedInStore,
      storedTotal: afterState.length,
      unsplit,
    });
    setPendingBatch(null);
  };

  /**
   * Stage the source rows exactly as read, with no splitting at all. Used after
   * an F5 refusal. Nothing is invented: one stored record per source row, each
   * marked needsReview so it cannot reach the map before a human has read it.
   */
  const importWithoutSplitting = () => {
    const rows = unsplitOffer;
    if (!rows) return;
    setError('');
    setUnsplitOffer(null);
    const flat = rows.map(r => ({
      ...r,
      inferredFields: [...new Set([...(r.inferredFields ?? [])])],
      needsReview: true,
    }));
    commitImport(
      {
        result: flat, splitCount: 0, newTotal: flat.length, originalTotal: rows.length,
        skipped: 0, capped: 0, mergedFragments: 0, factor: 1,
        exceedsBatchLimit: false, worstOffenders: [],
      },
      flat,
      0,
      true,
    );
  };

  const runImport = () => {
    const newIncidents = buildIncidentsFromSource();
    if (!newIncidents) return;
    setError('');
    setUnsplitOffer(null);

    const towns = Object.keys(SA_TOWN_COORDS);
    const batch = splitAllMultiIncidents(newIncidents, towns, geocodeForSplitter);

    // F5 â€” import-time rail. A multiplication must be discovered here, not later
    // on the dashboard. Refusal is hard: nothing reaches the store.
    if (batch.exceedsBatchLimit) {
      setError(buildRefusalMessage(batch, 'Importing this file'));
      // Offer the escape hatch. Previously a legitimately dense multi-incident
      // source became wholly unimportable with no path forward but hand-editing
      // the file. The rows themselves are fine â€” it is the SPLIT that is
      // untrustworthy â€” so they can be staged unsplit, flagged for review.
      setUnsplitOffer(newIncidents);
      return;
    }

    // Keep the computed batch. Re-deriving it on confirm would re-roll geocoding
    // and mint different ids for the very records the operator just reviewed.
    setPendingBatch(batch);

    const dupes = findDuplicates(batch.result, importedIncidents);
    if (dupes.length > 0) {
      setDuplicates(dupes);
      setSkipIds(new Set(dupes.map(d => d.newIncident.id)));
      return;
    }

    commitImport(batch, batch.result, 0);
  };

  /** `skip` is passed explicitly â€” reading it from state here would use the value
   *  from before the caller's setSkipIds, which is how "Import all anyway"
   *  previously dropped the very records it promised to keep. */
  const confirmImportWithDupes = (skip: Set<string>) => {
    const batch = pendingBatch;
    if (!batch) return;
    const toStage = batch.result.filter(inc => !skip.has(inc.id));
    commitImport(batch, toStage, batch.result.length - toStage.length);
    setDuplicates([]);
    setSkipIds(new Set());
  };

  const scanForInternalDupes = () => {
    const dupes = findInternalDuplicates(importedIncidents);
    setInternalDupes(dupes);
    setShowDedupScan(true);
  };

  const removeInternalDupe = (id: string) => {
    // Atomic replace â€” clear-then-add leaves the store empty if the second call
    // never runs, and re-adding passes every record back through the store's
    // fingerprint guard, which can silently discard survivors.
    replaceImportedIncidents(importedIncidents.filter(i => i.id !== id));
    setInternalDupes(prev => prev.filter(d => d.newIncident.id !== id && d.existing.id !== id));
  };

  const [cleanupReport, setCleanupReport] = useState<CleanupReport | null>(null);
  const [dedupReport, setDedupReport] = useState<number | null>(null);
  const [actionInProgress, setActionInProgress] = useState<'dedup' | 'split' | 'scan' | null>(null);
  const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null);
  const [splitRefusal, setSplitRefusal] = useState('');
  const [cleanupError, setCleanupError] = useState('');
  const [dedupPreview, setDedupPreview] = useState<DedupPreview | null>(null);
  const [reviewReport, setReviewReport] = useState<string>('');

  /**
   * "Remove Duplicates" used to call deduplicateImportedIncidents() straight
   * from the button handler: no preview, no confirmation, no list of what it
   * deleted, no undo â€” only an after-the-fact count. Every other destructive
   * path in this file is behind a preview-then-confirm rail or a typed RESET
   * gate; this one now is too, because a fingerprint collision here deletes a
   * genuinely distinct incident permanently.
   */
  const previewDedup = () => {
    setDedupReport(null);
    setDedupPreview(computeDedupPreview(importedIncidents));
  };

  const applyDedup = () => {
    const plan = dedupPreview;
    if (!plan) return;
    // Refuse a stale plan: the set must be byte-identical to what was shown.
    const currentKey = incidentSetKey(importedIncidents);
    if (plan.setKey !== currentKey) {
      setDedupPreview(null);
      setCleanupError('The stored set changed since these duplicates were listed. Nothing was deleted â€” run Remove Duplicates again.');
      return;
    }
    const removed = deduplicateImportedIncidents();
    setDedupPreview(null);
    setDedupReport(removed);
  };

  /**
   * Clear needsReview on records an editor has actually looked at. Without this
   * there is no path from "imported" to "publishable", and the needsReview flag
   * would be a one-way trap rather than a review queue.
   */
  const markReviewed = (ids: Set<string> | null) => {
    const target = ids ?? new Set(importedIncidents.filter(i => i.needsReview).map(i => i.id));
    let n = 0;
    const next = importedIncidents.map(inc => {
      if (!target.has(inc.id) || !inc.needsReview) return inc;
      n++;
      return { ...inc, needsReview: false };
    });
    if (n === 0) { setReviewReport('Nothing to confirm â€” no record is awaiting review.'); return; }
    replaceImportedIncidents(next);
    setReviewReport(`${n} record${n === 1 ? '' : 's'} confirmed by you and released to the public map. Their machine-derived fields are still listed on each record.`);
  };

  /**
   * F4 â€” compute a split plan and commit NOTHING. The operator sees before â†’
   * after, the factor, what was capped, and the rows responsible, then decides.
   */
  const previewSplitAndClean = () => {
    setSplitRefusal('');
    setCleanupError('');
    setSplitPreview(null);

    const towns = Object.keys(SA_TOWN_COORDS);
    const batch = splitAllMultiIncidents(importedIncidents, towns, geocodeForSplitter);

    if (batch.exceedsBatchLimit) {
      setSplitRefusal(buildRefusalMessage(batch, 'Splitting the stored set'));
      return;
    }

    setSplitPreview({
      setKey: incidentSetKey(importedIncidents),
      before: batch.originalTotal,
      after: batch.newTotal,
      factor: batch.factor,
      splitCount: batch.splitCount,
      alreadySplit: batch.skipped,
      capped: batch.capped,
      mergedFragments: batch.mergedFragments,
      worstOffenders: batch.worstOffenders,
      result: batch.result,
    });
  };

  /**
   * F1/F2/F3 â€” the cleanup pass itself never splits. Pass a confirmed preview to
   * apply split + clean; pass null to clean only. Either way the write is a
   * single atomic replace of a freshly cloned array.
   */
  const applyCleanup = (preview: SplitPreview | null) => {
    setCleanupError('');
    const before = importedIncidents.length;

    // Compare the full id list, not just the count. A same-length change
    // (one record removed, one added) previously slipped past this guard and
    // the stale plan was then written wholesale over the live set.
    if (preview && preview.setKey !== incidentSetKey(importedIncidents)) {
      setSplitPreview(null);
      setCleanupError(`The stored set changed (${preview.before} â†’ ${before} records, or the same count with different records) since this plan was computed. Nothing was written â€” run Split & Clean again.`);
      return;
    }

    const source = preview ? preview.result : importedIncidents;
    const { incidents, titlesFixed, casualtiesFilled, unchanged } = cleanIncidents(source);

    // Invariant: cleaning is one-in-one-out. If that ever stops being true, stop
    // rather than write a set that has quietly lost records.
    if (incidents.length !== source.length) {
      setCleanupError(`Aborted â€” the cleanup pass would have changed the record count from ${source.length} to ${incidents.length}. Nothing was written.`);
      return;
    }

    replaceImportedIncidents(incidents);
    setSplitPreview(null);
    setCleanupReport({
      action: preview ? 'split-clean' : 'clean-only',
      before,
      after: incidents.length,
      rowsSplit: preview?.splitCount ?? 0,
      recordsAdded: preview ? preview.after - preview.before : 0,
      fragmentsMerged: preview?.mergedFragments ?? 0,
      alreadySplit: preview?.alreadySplit ?? 0,
      capped: preview?.capped ?? 0,
      titlesFixed,
      casualtiesFilled,
      unchanged,
      removed: 0,
    });
  };

  const handleDedup = () => {
    setActionInProgress('dedup');
    setDedupReport(null);
    setCleanupReport(null);
    setTimeout(() => {
      previewDedup();
      setActionInProgress(null);
    }, 50);
  };

  const handleSplitClean = () => {
    setActionInProgress('split');
    setDedupReport(null);
    setCleanupReport(null);
    setTimeout(() => {
      previewSplitAndClean();
      setActionInProgress(null);
    }, 50);
  };

  const handleApplyPlan = () => {
    const plan = splitPreview;
    setActionInProgress('split');
    setTimeout(() => {
      applyCleanup(plan);
      setActionInProgress(null);
    }, 50);
  };

  const handleCleanOnly = () => {
    setActionInProgress('split');
    setDedupReport(null);
    setCleanupReport(null);
    setTimeout(() => {
      applyCleanup(null);
      setActionInProgress(null);
    }, 50);
  };

  const handleScan = () => {
    setActionInProgress('scan');
    setTimeout(() => {
      scanForInternalDupes();
      setActionInProgress(null);
    }, 50);
  };

  // --- Recovery & reset (design part D) ---
  const inventory = useMemo(() => buildInventory(importedIncidents), [importedIncidents]);
  const [showRecovery, setShowRecovery] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [resetResult, setResetResult] = useState<number | null>(null);

  const handleSnapshot = () => {
    setSnapshotName(downloadSnapshot(importedIncidents));
  };

  const handleReset = () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
    const cleared = importedIncidents.length;
    clearImportedIncidents();
    setResetConfirmText('');
    setResetResult(cleared);
    setSplitPreview(null);
    setCleanupReport(null);
    setDedupReport(null);
    setInternalDupes([]);
    setShowDedupScan(false);
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
    return { modules, severities, piiCount, warningCount, flagCount, fakeNewsCount, gapCount, avgCompleteness: Math.round(sortedRows.reduce((s, r) => s + r.completeness, 0) / sortedRows.length) };
  }, [sortedRows]);

  const oversizedAttachments = attachments.filter(a => a.sizeBytes > MAX_IMAGE_BYTES);
  const pendingAttachments = attachments.filter(a => a.status === 'pending');

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Import Data</h1>
        <p>Upload incident records, attach evidence files, and use AI to sort public vs. confidential fields. Everything enters the review queue â€” nothing publishes automatically.</p>
      </div>

      {/* â”€â”€ Upload zone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
          <div className="import-dropzone-sub">CSV / TSV / PDF parsed here Â· XLS / XLSX / DOC handled on upload</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xls,.xlsx,.doc,.docx,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
        {error && (
          <div className="import-msg error" style={{ whiteSpace: 'pre-wrap' }}>
            {error}
            {unsplitOffer && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={importWithoutSplitting}>
                  Import all {unsplitOffer.length} rows WITHOUT splitting
                </button>
                <span style={{ fontSize: 11 }}>
                  One stored record per source row, exactly as read. Nothing is separated out, so no record count is inflated â€”
                  each row keeps all of its incidents in one summary and is held for review.
                </span>
              </div>
            )}
          </div>
        )}
        {notice && <div className="import-msg notice">{notice}</div>}
        {pdfExtracting && (
          <div className="import-msg notice" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner-dot" />
            Extracting text from document â€” reading contentâ€¦
          </div>
        )}
        {isPdf && !pdfExtracting && dataRows.length > 0 && (
          <div className="import-msg notice">
            Document extracted â€” {dataRows.length} potential incident{dataRows.length !== 1 ? 's' : ''} identified. Fields are auto-mapped. Use <strong>AI Sort</strong> to classify, extract PII, and assess each record.
          </div>
        )}
      </div>

      {/* â”€â”€ Attachments / Evidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Evidence Attachments</h2>
          <button className="btn btn-secondary" onClick={() => attachRef.current?.click()} disabled={compressing}>
            {compressing ? 'Processingâ€¦' : '+ Add files'}
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
                      <span style={{ color: '#38a169' }}>â†’ {formatBytes(a.compressedSizeBytes)} compressed</span>
                    )}
                    {a.sizeBytes > MAX_IMAGE_BYTES && !a.compressedBlob && !a.isImage && (
                      <span style={{ color: '#ed8936' }}>Large file â€” 7-day retention</span>
                    )}
                    <span>Â·</span>
                    {a.isImage ? (
                      <span style={{ color: a.status === 'approved' ? '#38a169' : a.status === 'rejected' ? '#c53030' : '#d69e2e' }}>
                        {a.status === 'approved' ? 'âœ“ Approved for public' : a.status === 'rejected' ? 'âœ— Confidential only' : 'â—Œ Pending review'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Document â€” admin only</span>
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
                        âœ“
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11, background: a.status === 'rejected' ? 'rgba(197,48,48,0.2)' : undefined, color: a.status === 'rejected' ? '#c53030' : undefined }}
                        onClick={() => updateAttachment(a.id, { status: a.status === 'rejected' ? 'pending' : 'rejected' })}
                        title="Keep confidential (admin only)"
                      >
                        âœ—
                      </button>
                    </>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => removeAttachment(a.id)}
                    title="Remove"
                  >
                    Ã—
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {oversizedAttachments.length > 0 && (
          <div className="import-msg warning" style={{ marginTop: 8 }}>
            <strong>{oversizedAttachments.length} oversized file{oversizedAttachments.length > 1 ? 's' : ''}</strong> â€” originals stored in 7-day retention queue.
            {' '}Check "Keep permanently" for files that should not auto-delete. All others are removed after 7 days to save storage.
          </div>
        )}
      </div>

      {/* â”€â”€ Column mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {headers.length > 0 && (
        <>
          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>Map Columns to Fields</h2>
                <p className="form-hint" style={{ margin: '4px 0 0' }}>{mappedCount} of {TARGET_FIELDS.length} fields mapped. Confidential fields marked with ðŸ”’</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={runAISort}
                disabled={sorting || mappedCount === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: sorted ? '#38a169' : undefined }}
              >
                {sorting ? (
                  <><span className="spinner-dot" /> Sortingâ€¦</>
                ) : sorted ? (
                  'âœ“ AI Sorted'
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
                    {f.confidential && <span style={{ marginRight: 4 }} title="Confidential â€” admin only">ðŸ”’</span>}
                    {f.label}
                  </span>
                  <select
                    className="form-input"
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => { setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) })); setSorted(false); setSortedRows([]); }}
                  >
                    <option value={-1}>â€” not mapped â€”</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* â”€â”€ AI Sort results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#38a169' }}>{stats.avgCompleteness}%</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }} title="Share of target fields that were mapped. This is a completeness measure, not an accuracy or confidence judgement.">
                      Avg fields mapped
                    </div>
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
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sortedRows.length} rows Â· click to expand</span>
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
                            {row.public['Summary / notes'] || row.public['Location / where'] || row.rawRow[0] || 'â€”'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.flags.some(f => f.type === 'fake_news') && (
                              <span title="Possible fake news detected" style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>ðŸš© FAKE?</span>
                            )}
                            {row.flags.some(f => f.type === 'inaccurate') && (
                              <span title="Inaccurate data flagged" style={{ fontSize: 10, color: '#ef4444' }}>âŒ</span>
                            )}
                            {row.warnings.length > 0 && (
                              <span title={row.warnings.join('\n')} style={{ fontSize: 10, color: '#d69e2e' }}>âš  {row.warnings.length}</span>
                            )}
                            {Object.keys(row.confidential).length > 0 && (
                              <span style={{ fontSize: 10, color: '#c53030' }} title="Contains confidential data">ðŸ”’</span>
                            )}
                            <span
                              title="Share of target fields mapped for this row. Completeness, NOT accuracy â€” it says nothing about whether any value is correct."
                              style={{
                                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                                background: row.completeness >= 70 ? 'rgba(56,161,105,0.15)' : row.completeness >= 40 ? 'rgba(214,158,46,0.15)' : 'rgba(197,48,48,0.15)',
                                color: row.completeness >= 70 ? '#38a169' : row.completeness >= 40 ? '#d69e2e' : '#c53030',
                              }}
                            >
                              {row.completeness}% mapped
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expanded ? 'â–²' : 'â–¼'}</span>
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
                                Public â€” visible on map
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
                                ðŸ”’ Confidential â€” admin only
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
                                    <div key={wi} style={{ fontSize: 10, color: '#d69e2e', marginBottom: 2 }}>âš  {w}</div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {row.inferredFields.length > 0 && (
                              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, color: '#d69e2e' }}>
                                  Machine-derived â€” the source did not state these
                                </div>
                                {row.inferredFields.map(f => (
                                  <div key={f} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                                    â—‹ {inferredFieldLabel(f)}
                                  </div>
                                ))}
                              </div>
                            )}

                            {row.flags.length > 0 && (
                              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, color: 'var(--text-muted)' }}>
                                  AI Flags â€” admin review required
                                </div>
                                {row.flags.map((flag, fi) => (
                                  <div key={fi} style={{
                                    fontSize: 11, padding: '4px 8px', borderRadius: 4, marginBottom: 3,
                                    background: flag.type === 'fake_news' ? '#ef444418' : flag.type === 'inaccurate' ? '#ef444418' : flag.type === 'suspicious' ? '#f9731618' : 'var(--bg-elevated)',
                                    color: flag.type === 'fake_news' ? '#ef4444' : flag.type === 'inaccurate' ? '#ef4444' : flag.type === 'suspicious' ? '#f97316' : 'var(--text-secondary)',
                                    border: `1px solid ${flag.type === 'fake_news' || flag.type === 'inaccurate' ? '#ef444433' : flag.type === 'suspicious' ? '#f9731633' : 'var(--border)'}`,
                                  }}>
                                    <span style={{ fontWeight: 600 }}>
                                      {flag.type === 'fake_news' ? 'ðŸš© POSSIBLE FAKE' : flag.type === 'inaccurate' ? 'âŒ INACCURATE' : flag.type === 'suspicious' ? 'âš  SUSPICIOUS' : 'â—‹ GAP'}
                                    </span>
                                    {' â€” '}{flag.field}: {flag.message}
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

          {/* â”€â”€ Preview (before AI sort) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {!sorted && headers.length > 0 && (
            <div className="admin-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Raw Preview</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dataRows.length} rows</span>
              </div>
              {isPdf && (
                <div className="import-msg warning" style={{ marginBottom: 10 }}>
                  These rows were pattern-matched out of document prose â€” there were no labelled source columns to read.
                  Columns marked <strong>â—† derived</strong> below were produced by this machine, not stated by the document as a field.
                  Verdict and case status are never derived: they stay blank until a human fills them in.
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>{TARGET_FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => {
                      const derived = isPdf && DOC_DERIVED_KEYS.has(f.key);
                      return (
                        <th key={f.key}>
                          {f.confidential && <span title="Confidential" style={{ marginRight: 3 }}>ðŸ”’</span>}
                          {f.label}
                          {derived && (
                            <span title="Machine-derived from document text â€” not a source-supplied field" style={{ marginLeft: 4, fontSize: 9, color: '#d69e2e' }}>
                              â—† derived
                            </span>
                          )}
                        </th>
                      );
                    })}</tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 8).map((r, ri) => (
                      <tr key={ri}>
                        {TARGET_FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => {
                          const derived = isPdf && DOC_DERIVED_KEYS.has(f.key);
                          return (
                            <td
                              key={f.key}
                              style={
                                f.confidential
                                  ? { color: '#e78', fontStyle: 'italic' }
                                  : derived
                                    ? { color: '#d69e2e' }
                                    : undefined
                              }
                            >
                              {r[mapping[f.key]] ?? ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataRows.length > 8 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Showing first 8 of {dataRows.length} rows. Use AI Sort to process all rows.</div>}
            </div>
          )}

          {/* â”€â”€ Import button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="admin-card">
            {duplicates.length > 0 ? (
              <div>
                <div className="import-msg warning" style={{ marginBottom: 12 }}>
                  Found {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''} in the new data. Review below â€” uncheck any you want to keep.
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
                            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.newIncident.dateOccurred} Â· {d.newIncident.town || d.newIncident.province}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{d.existing.title}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.existing.dateOccurred} Â· {d.existing.town || d.existing.province}</div>
                          </td>
                          <td style={{ fontSize: 12, fontWeight: 700, color: d.score >= 80 ? '#c53030' : '#d69e2e' }}>{d.score}%</td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.reasons.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => confirmImportWithDupes(skipIds)}>
                    Import {(pendingBatch?.newTotal ?? 0) - skipIds.size} records (skip {skipIds.size} duplicate{skipIds.size !== 1 ? 's' : ''})
                  </button>
                  <button className="btn btn-secondary" onClick={() => confirmImportWithDupes(new Set())}>
                    Import all {pendingBatch?.newTotal ?? 0} anyway
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setDuplicates([]); setSkipIds(new Set()); setPendingBatch(null); }}>Cancel</button>
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
                    {pendingAttachments.length > 0 && <span style={{ color: '#d69e2e' }}> Â· {pendingAttachments.length} pending approval</span>}
                  </span>
                )}
              </div>
            ) : (
              <div className="import-msg success">
                âœ“ {imported} records staged to the review queue from <strong>{importReport?.fileName || fileName}</strong>.
                {sorted && <> The sorter separated public/confidential fields. </>}
                {attachments.length > 0 && (
                  <> {attachments.filter(a => a.status === 'approved').length} attachment{attachments.filter(a => a.status === 'approved').length !== 1 ? 's' : ''} approved for public, {attachments.filter(a => a.status !== 'approved').length} kept confidential. </>
                )}
                An editor must approve each record before it appears on the map.
                {importReport && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                    <li><strong>{importReport.sourceRows}</strong> source row{importReport.sourceRows === 1 ? '' : 's'} read from the file</li>
                    {importReport.unsplit && (
                      <li style={{ color: '#d69e2e' }}>
                        Imported <strong>without splitting</strong> at your request â€” one record per source row, exactly as read. Rows holding several incidents still hold them.
                      </li>
                    )}
                    <li>
                      <strong>{importReport.rowsSplit}</strong> row{importReport.rowsSplit === 1 ? '' : 's'} contained more than one incident and were split,
                      producing <strong>{importReport.recordsAdded}</strong> extra record{importReport.recordsAdded === 1 ? '' : 's'}
                      {importReport.sourceRows > 0 && <> ({(importReport.offered / importReport.sourceRows).toFixed(2)}Ã— before duplicate handling)</>}
                    </li>
                    <li><strong>{importReport.fragmentsMerged}</strong> fragment{importReport.fragmentsMerged === 1 ? '' : 's'} merged back into a neighbouring entry (too little evidence to stand alone â€” text kept, not discarded)</li>
                    {importReport.capped > 0 && (
                      <li style={{ color: '#d69e2e' }}>
                        <strong>{importReport.capped}</strong> row{importReport.capped === 1 ? '' : 's'} hit the {MAX_SPLIT_FACTOR}-per-row cap. Their remaining text is kept in one record flagged for review â€” nothing was dropped, but these need manual triage.
                      </li>
                    )}
                    {importReport.skippedByOperator > 0 && (
                      <li><strong>{importReport.skippedByOperator}</strong> record{importReport.skippedByOperator === 1 ? '' : 's'} skipped by you as duplicates</li>
                    )}
                    {importReport.rejectedByStore > 0 && (
                      <li style={{ color: '#d69e2e' }}>
                        <strong>{importReport.rejectedByStore}</strong> record{importReport.rejectedByStore === 1 ? '' : 's'} not added â€” the store already held a record with the same description + title + date + place
                      </li>
                    )}
                    {importReport.replacedInStore > 0 && (
                      <li style={{ color: '#d69e2e' }}>
                        <strong>{importReport.replacedInStore}</strong> record{importReport.replacedInStore === 1 ? '' : 's'} <strong>replaced</strong> a stored record with the same id. Any edits previously made to those records were overwritten.
                      </li>
                    )}
                    <li><strong>{importReport.staged}</strong> newly staged Â· <strong>{importReport.storedTotal}</strong> incidents now stored in total</li>
                    <li>
                      Nothing staged here is on the public map yet â€” every imported record is held for review because at least one of its
                      fields (module and severity are always keyword guesses) was produced by machine. Release them from
                      <em> Stored Incidents â†’ Review queue</em> once you have checked them.
                    </li>
                  </ul>
                )}
                <div style={{ marginTop: 10 }}><button className="btn btn-secondary" onClick={reset}>Import another file</button></div>
              </div>
            )}
          </div>
        </>
      )}

      {/* â”€â”€ Retention queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Stored incidents & storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {(importedIncidents.length > 0 || resetResult !== null) && (
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Stored Incidents</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" onClick={handleDedup} disabled={!!actionInProgress} style={{ fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }} title="Lists exactly which records would be deleted and waits for your confirmation. Nothing is deleted until you approve it.">
                {actionInProgress === 'dedup' ? <><span className="spinner-dot" /> Checkingâ€¦</> : 'Remove Duplicatesâ€¦'}
              </button>
              <button className="btn btn-secondary" onClick={handleSplitClean} disabled={!!actionInProgress} style={{ fontSize: 11, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }} title="Computes a plan and shows it for confirmation. Nothing is written until you approve it.">
                {actionInProgress === 'split' ? <><span className="spinner-dot" /> Workingâ€¦</> : 'Split & Cleanâ€¦'}
              </button>
              <button className="btn btn-secondary" onClick={handleScan} disabled={!!actionInProgress} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                {actionInProgress === 'scan' ? <><span className="spinner-dot" /> Scanningâ€¦</> : 'Scan for duplicates'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowRecovery(v => !v); setResetResult(null); }} disabled={!!actionInProgress} style={{ fontSize: 11, color: '#c53030' }}>
                {showRecovery ? 'Hide recovery & reset' : 'Recovery & resetâ€¦'}
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
              <div style={{ fontSize: 20, fontWeight: 700, color: importedIncidents.filter(i => !i.isSynthetic && !i.needsReview).length > 0 ? '#38a169' : 'var(--text-muted)' }}>
                {importedIncidents.filter(i => !i.isSynthetic && !i.needsReview).length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }} title="Only records you have confirmed reach the public map. Records awaiting review are held back.">
                On map (confirmed)
              </div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: inventory.withInferredFields > 0 ? '#d69e2e' : 'var(--text-muted)' }}>{inventory.withInferredFields}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }} title="Records carrying at least one field this machine derived rather than read from the source.">
                With derived fields
              </div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{inventory.distinctRoots}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Distinct source rows</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: inventory.needsReview > 0 ? '#d69e2e' : 'var(--text-muted)' }}>{inventory.needsReview}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Awaiting review</div>
            </div>
          </div>

          {inventory.total > inventory.distinctRoots * 3 && (
            <div className="import-msg warning" style={{ marginTop: 10 }}>
              <strong>{inventory.total}</strong> records trace back to only <strong>{inventory.distinctRoots}</strong> source rows
              ({(inventory.total / Math.max(1, inventory.distinctRoots)).toFixed(1)}Ã— multiplication).
              Do not publish counts from this set. Open <em>Recovery &amp; reset</em>, export a snapshot, then re-import the original file.
            </div>
          )}

          {/* â”€â”€ Provenance: what in this set was NOT stated by the source â”€â”€
              This is the reader that makes inferredFields mean something. Before
              it existed the flags were written to storage and shown to nobody,
              so a machine-derived value was indistinguishable from a
              source-stated one everywhere it mattered. */}
          {inventory.inferredCounts.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #d69e2e55', borderRadius: 6, background: '#d69e2e10' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 13, color: '#d69e2e' }}>Machine-derived fields in this set</h3>
              <p className="form-hint" style={{ marginTop: 0 }}>
                Every entry below is a value this application produced, not one the source stated.
                <strong> {inventory.withInferredFields}</strong> of <strong>{inventory.total}</strong> stored records carry at least one.
                They are also listed on each incident where it is displayed.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead><tr><th style={{ width: 90 }}>Records</th><th>What was derived</th></tr></thead>
                  <tbody>
                    {inventory.inferredCounts.map(f => (
                      <tr key={f.key}>
                        <td style={{ fontSize: 12, fontWeight: 700 }}>{f.count}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{inferredFieldLabel(f.key)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {inventory.withoutStatedDeceased > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  <strong>{inventory.withoutStatedDeceased}</strong> record{inventory.withoutStatedDeceased === 1 ? '' : 's'} state no fatality figure at all.
                  They contribute nothing to the â€œTotal deceased recordedâ€ number â€” that total covers only the {inventory.total - inventory.withoutStatedDeceased} records
                  whose source gave an explicit figure. It is not a count of deaths across the whole set.
                </div>
              )}
            </div>
          )}

          {/* â”€â”€ Review queue release â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {inventory.needsReview > 0 && (
            <div id="review-queue" style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>Review queue</h3>
              <p className="form-hint" style={{ marginTop: 0 }}>
                <strong>{inventory.needsReview}</strong> record{inventory.needsReview === 1 ? ' is' : 's are'} held back from the public map because at least one of their
                fields was produced by machine. Read the derived-field list above, check the records, then confirm them â€”
                confirming is you taking responsibility for those values, not the machine.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => markReviewed(null)} disabled={!!actionInProgress}>
                  I have checked these â€” release {inventory.needsReview} record{inventory.needsReview === 1 ? '' : 's'} to the map
                </button>
                {reviewReport && <span style={{ fontSize: 11, color: '#38a169' }}>{reviewReport}</span>}
              </div>
            </div>
          )}

          {/* â”€â”€ Duplicate deletion preview â€” nothing is deleted until confirmed â”€â”€ */}
          {dedupPreview && (
            <div style={{ marginTop: 10, padding: 12, border: '1px solid #d97706', borderRadius: 6, background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Review before anything is deleted</div>
              {dedupPreview.wouldRemove === 0 ? (
                <>
                  <div className="import-msg success" style={{ marginBottom: 8 }}>No duplicates found â€” nothing would be deleted.</div>
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setDedupPreview(null)}>Close</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <strong>{dedupPreview.wouldRemove}</strong> of <strong>{dedupPreview.total}</strong> records would be
                    <strong style={{ color: '#c53030' }}> permanently deleted</strong>. This cannot be undone â€” export a snapshot first if you are unsure.
                  </div>
                  <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                    <table className="admin-table">
                      <thead><tr><th>Kept</th><th>Deleted</th><th>Matched on</th></tr></thead>
                      <tbody>
                        {dedupPreview.pairs.slice(0, 50).map(p => (
                          <tr key={p.remove.id}>
                            <td style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{p.keep.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>{p.keep.id}</div>
                            </td>
                            <td style={{ fontSize: 12, color: '#c53030' }}>
                              <div style={{ fontWeight: 600 }}>{p.remove.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>{p.remove.id}</div>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>identical description + title + date + place</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {dedupPreview.pairs.length > 50 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Showing the first 50 of {dedupPreview.pairs.length} pairs.</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" style={{ fontSize: 11, color: '#c53030' }} onClick={applyDedup} disabled={!!actionInProgress}>
                      Delete these {dedupPreview.wouldRemove} records
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setDedupPreview(null)} disabled={!!actionInProgress}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* â”€â”€ Recovery & reset (design part D) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {showRecovery && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Recovery &amp; reset</h3>
              <p className="form-hint" style={{ marginTop: 0 }}>
                Inspect what is actually stored, keep a copy of it, then start again from the original file.
                These records live only in this browser (IndexedDB) â€” nothing has been written to a server.
                The Backup &amp; Restore feature does <strong>not</strong> cover incidents, so the export below is the only copy you will have.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, margin: '10px 0' }}>
                {[
                  { label: 'Records stored', value: inventory.total },
                  { label: 'Distinct source rows', value: inventory.distinctRoots },
                  { label: 'Split products', value: inventory.splitProducts },
                  { label: 'Legacy split ids', value: inventory.legacySplitProducts },
                  { label: 'From capped rows', value: inventory.cappedProducts },
                  { label: 'No resolvable position', value: inventory.withoutCoordinates },
                  { label: 'Deceased â€” from explicit figures only', value: inventory.totalDeceased },
                  { label: 'Records stating no fatality figure', value: inventory.withoutStatedDeceased },
                ].map(s => (
                  <div key={s.label} style={{ padding: '8px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 5 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {inventory.legacySplitProducts > 0 && (
                <div className="import-msg warning" style={{ marginBottom: 10 }}>
                  {inventory.legacySplitProducts} record{inventory.legacySplitProducts === 1 ? ' carries' : 's carry'} an accreting id from the old splitter and no provenance stamp.
                  Their original titles and casualty figures were overwritten in place and cannot be recovered from the store â€” only a re-import restores them.
                </div>
              )}

              {inventory.topParents.length > 0 && inventory.topParents[0]!.count > 1 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Source rows that produced the most records</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead><tr><th>Source row id</th><th style={{ width: 120 }}>Records produced</th></tr></thead>
                      <tbody>
                        {inventory.topParents.filter(p => p.count > 1).map(p => (
                          <tr key={p.rootId}>
                            <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.rootId}</td>
                            <td style={{ fontSize: 12, fontWeight: 700, color: p.count > MAX_SPLIT_FACTOR ? '#c53030' : 'var(--text-secondary)' }}>{p.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={handleSnapshot} disabled={inventory.total === 0}>
                  â¬‡ Export snapshot ({inventory.total} records)
                </button>
                {snapshotName && <span style={{ fontSize: 11, color: '#38a169' }}>Saved {snapshotName}</span>}
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#c53030', marginBottom: 4 }}>Delete every stored incident</div>
                <p className="form-hint" style={{ marginTop: 0 }}>
                  Irreversible. Export a snapshot first. Afterwards the app falls back to its built-in sample incidents â€” that is expected, and those are not your data.
                  Close any other tab of this app before resetting, or a stale tab may write its old copy back.
                  Type <strong>RESET</strong> to enable the button.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    style={{ width: 120, padding: '4px 8px', fontSize: 12, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
                  />
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 11, color: '#c53030' }}
                    disabled={resetConfirmText.trim().toUpperCase() !== 'RESET' || !!actionInProgress}
                    onClick={handleReset}
                  >
                    Delete all {inventory.total} records
                  </button>
                </div>
                {resetResult !== null && (
                  <div className="import-msg success" style={{ marginTop: 8 }}>
                    Deleted {resetResult} records. Re-import the original file â€” the import now refuses any batch above {MAX_BATCH_FACTOR}Ã—.
                  </div>
                )}
              </div>
            </div>
          )}

          {dedupReport !== null && (
            <div className="import-msg success" style={{ marginTop: 10 }}>
              {dedupReport > 0
                ? `Removed ${dedupReport} duplicate incidents. Total incidents now: ${importedIncidents.length}.`
                : 'No duplicates found â€” all incidents are unique.'}
              <button onClick={() => setDedupReport(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>Dismiss</button>
            </div>
          )}
          {splitRefusal && (
            <div className="import-msg error" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
              {splitRefusal}
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setSplitRefusal('')}>Dismiss</button>
              </div>
            </div>
          )}

          {cleanupError && (
            <div className="import-msg error" style={{ marginTop: 10 }}>
              {cleanupError}
              <button onClick={() => setCleanupError('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>Dismiss</button>
            </div>
          )}

          {/* â”€â”€ Split plan preview â€” nothing is written until confirmed â”€â”€â”€â”€ */}
          {splitPreview && (
            <div style={{ marginTop: 10, padding: 12, border: '1px solid #2563eb', borderRadius: 6, background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Review before anything is written</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>{splitPreview.before}</strong> â†’ <strong style={{ color: splitPreview.factor > 1.5 ? '#d69e2e' : '#38a169' }}>{splitPreview.after}</strong> records
                {' '}(<strong>{splitPreview.factor.toFixed(2)}Ã—</strong>, limit {MAX_BATCH_FACTOR}Ã—)
              </div>
              <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                <li><strong>{splitPreview.splitCount}</strong> row{splitPreview.splitCount === 1 ? '' : 's'} would be split into more than one incident</li>
                <li><strong>{splitPreview.after - splitPreview.before}</strong> record{splitPreview.after - splitPreview.before === 1 ? '' : 's'} added</li>
                <li><strong>{splitPreview.mergedFragments}</strong> fragment{splitPreview.mergedFragments === 1 ? '' : 's'} merged back into a neighbour (kept, not discarded)</li>
                <li><strong>{splitPreview.alreadySplit}</strong> record{splitPreview.alreadySplit === 1 ? '' : 's'} left untouched â€” already a product of an earlier split</li>
                {splitPreview.capped > 0 && (
                  <li style={{ color: '#d69e2e' }}>
                    <strong>{splitPreview.capped}</strong> row{splitPreview.capped === 1 ? '' : 's'} hit the {MAX_SPLIT_FACTOR}-per-row cap â€” the remaining text stays in one record flagged for review
                  </li>
                )}
              </ul>
              {splitPreview.worstOffenders.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                  <table className="admin-table">
                    <thead><tr><th>Source row</th><th style={{ width: 80 }}>Produces</th><th>Text</th></tr></thead>
                    <tbody>
                      {splitPreview.worstOffenders.map(o => (
                        <tr key={o.id}>
                          <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{o.id}</td>
                          <td style={{ fontSize: 12, fontWeight: 700, color: o.capped ? '#c53030' : 'var(--text-secondary)' }}>
                            {o.childCount}{o.capped ? ' (capped)' : ''}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.excerpt}â€¦</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={handleApplyPlan} disabled={!!actionInProgress}>
                  Apply split &amp; clean ({splitPreview.before} â†’ {splitPreview.after})
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={handleCleanOnly} disabled={!!actionInProgress}>
                  Clean only â€” do not split
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setSplitPreview(null)} disabled={!!actionInProgress}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {cleanupReport && (
            <div className="import-msg success" style={{ marginTop: 10 }}>
              <strong>{cleanupReport.action === 'split-clean' ? 'Split & clean applied' : 'Clean applied (no splitting)'}</strong>
              {' â€” '}{cleanupReport.before} â†’ {cleanupReport.after} records.
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                <li><strong>{cleanupReport.rowsSplit}</strong> split Â· <strong>{cleanupReport.recordsAdded}</strong> record{cleanupReport.recordsAdded === 1 ? '' : 's'} added</li>
                <li><strong>{cleanupReport.fragmentsMerged}</strong> merged back into a neighbour</li>
                <li><strong>{cleanupReport.alreadySplit}</strong> already split, left untouched</li>
                <li><strong>{cleanupReport.titlesFixed}</strong> title{cleanupReport.titlesFixed === 1 ? '' : 's'} repaired Â· <strong>{cleanupReport.casualtiesFilled}</strong> casualty figure{cleanupReport.casualtiesFilled === 1 ? '' : 's'} filled from an explicit number in the summary</li>
                <li><strong>{cleanupReport.unchanged}</strong> record{cleanupReport.unchanged === 1 ? '' : 's'} unchanged</li>
                <li><strong>{cleanupReport.removed}</strong> removed â€” cleaning never deletes a record. Use <em>Remove Duplicates</em> for that.</li>
                {cleanupReport.capped > 0 && <li style={{ color: '#d69e2e' }}><strong>{cleanupReport.capped}</strong> capped row{cleanupReport.capped === 1 ? '' : 's'} need manual triage</li>}
              </ul>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Running this again changes nothing â€” split products are stamped and never re-split.
              </div>
              <button onClick={() => setCleanupReport(null)} style={{ marginLeft: 0, marginTop: 6, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 11, display: 'block' }}>Dismiss</button>
            </div>
          )}
          {showDedupScan && (
            <div style={{ marginTop: 12 }}>
              {internalDupes.length === 0 ? (
                <div className="import-msg success">No duplicates found â€” data is clean.</div>
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
                              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.existing.dateOccurred} Â· {d.existing.town || d.existing.province}</div>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{d.newIncident.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.newIncident.dateOccurred} Â· {d.newIncident.town || d.newIncident.province}</div>
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
        <strong>How Sort works â€” and what it does not do.</strong> This is a deterministic keyword and regular-expression pass running in your browser. It is not a model and it makes no judgement about whether anything is true. It (1) <em>guesses</em> a module and severity from keywords â€” a row matching no keyword is left <em>Unclassified</em> and <em>Unassessed</em> rather than defaulted into Farm &amp; Rural / Medium; (2) extracts names, phone numbers, email addresses and case references from free text and moves them to a confidential store visible only to admins; (3) produces a redacted public summary. Every value it produces rather than reads is recorded on the record and listed under <em>Machine-derived fields</em>, and those records are held back from the public map until you confirm them.
        {' '}<strong>What is never derived:</strong> a verdict, a case status, a suspect's name, a date, or a map position. A source that states no date gets no date; a location that cannot be matched to the built-in gazetteer gets no coordinates rather than an approximate point.
        {' '}<strong>PDF/DOCX import:</strong> text is extracted page-by-page and split into records using paragraph boundaries and structural markers. Every field on that path is pattern-matched out of prose, is marked <em>â—† derived</em> in the preview, and the full source chunk is always kept verbatim in the summary.
        {' '}Images attached to submissions are individually approvable â€” only approved images are ever visible to the public. Originals of large files are kept in a 7-day retention queue; admins can mark specific files for permanent storage.
      </div>
    </div>
  );
}

