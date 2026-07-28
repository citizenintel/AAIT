export interface Submission {
  id: string;
  title: string;
  status: string;
  module: string;
  submitted: string;
  knowledgeType: string;
  reporter: string;
  reporterEmail: string;
  attachments: number;
  attachmentBytes: number;
  oversized: boolean;
  retentionExpiry: string | null;
  town: string;
  province: string;
  dateOccurred: string;
  severity: string;
  sapsNumber: string;
  narrative: string;
  motives: string[];
}

export const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: 'SUB-001', title: 'Farm attack report — Polokwane area', status: 'pending_review', module: 'ait',
    submitted: '2026-07-20', knowledgeType: 'witness', reporter: 'J. van der Merwe DEMO', reporterEmail: 'jvdm.demo@example.com',
    attachments: 2, attachmentBytes: 524288, oversized: false, retentionExpiry: null,
    town: 'Polokwane', province: 'Limpopo', dateOccurred: '2026-07-19', severity: 'critical', sapsNumber: 'CAS 214/07/2026',
    narrative: 'My neighbour Johan Pretorius phoned me around 03:00. Two armed men entered the farmhouse on the R81 smallholding. The owner was assaulted and taken to hospital. A case was opened at Polokwane SAPS, CAS 214/07/2026. You can reach me on 082 555 1234 or jvdm.demo@example.com for follow-up.',
    motives: ['home_invasion', 'assault', 'robbery_theft'],
  },
  {
    id: 'SUB-002', title: 'Water outage Soweto', status: 'under_review', module: 'infrastructure',
    submitted: '2026-07-19', knowledgeType: 'victim', reporter: 'Nomsa D. DEMO', reporterEmail: 'nomsa.demo@example.com',
    attachments: 0, attachmentBytes: 0, oversized: false, retentionExpiry: null,
    town: 'Soweto', province: 'Gauteng', dateOccurred: '2026-07-18', severity: 'medium', sapsNumber: '',
    narrative: 'No water in Zone 4 for five days. Johannesburg Water says a pump failed. Whole street affected. My number is 073 111 2222 if you need more.',
    motives: ['service_delivery'],
  },
  {
    id: 'SUB-003', title: 'Protest N1 Musina', status: 'pending_review', module: 'unrest',
    submitted: '2026-07-20', knowledgeType: 'media', reporter: 'Anon DEMO', reporterEmail: 'tipoff.demo@example.com',
    attachments: 1, attachmentBytes: 102400, oversized: false, retentionExpiry: null,
    town: 'Musina', province: 'Limpopo', dateOccurred: '2026-07-20', severity: 'high', sapsNumber: '',
    narrative: 'Residents blockaded the N1 with burning tyres over water. Traffic backed up 8km. Police fired rubber bullets. Saw it reported on eNCA.',
    motives: ['political', 'service_delivery'],
  },
  {
    id: 'SUB-004', title: 'Farm attack with video evidence — Tzaneen', status: 'pending_review', module: 'ait',
    submitted: '2026-07-21', knowledgeType: 'witness', reporter: 'Citizen Reporter DEMO', reporterEmail: 'test.demo@example.com',
    attachments: 1, attachmentBytes: 7340032, oversized: true, retentionExpiry: '2026-07-28',
    town: 'Tzaneen', province: 'Limpopo', dateOccurred: '2026-07-21', severity: 'high', sapsNumber: '',
    narrative: 'Large video file attached showing security footage. Incident occurred on the R71 near Tzaneen.',
    motives: ['home_invasion', 'assault'],
  },
];

// Words that look like a name but are places/orgs — never redact these as names.
const NOT_A_NAME = /^(SAPS|Police|Water|Municipality|Metro|Council|News|Hospital|Dam|Road|Street|Avenue|Zone|Cape|Town|Province|Department|Eskom|Johannesburg|Pretoria|Polokwane|Soweto|Musina|Limpopo|Gauteng|Western|Eastern|Northern|Free|North|South|The|Two|Three|My|No|Traffic|Residents)$/;

// Strip SA phone, email and case-number patterns, the reporter's own name, and any
// First-Last person names appearing in the free text. Deterministic — never invents.
function redact(text: string, reporterName: string): string {
  let out = text;
  const clean = reporterName.replace(/\s*DEMO\s*/i, '').trim();
  if (clean) out = out.split(clean).join('[name withheld]');
  out = out.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email withheld]');
  out = out.replace(/(\+?27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, '[contact withheld]');
  out = out.replace(/\b(CAS|CASE|MAS)\s?\d+\/\d+\/\d+/gi, '[case ref withheld]');
  // Likely person names: two consecutive Title-case words, unless either is a place/org term.
  out = out.replace(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g, (m, a, b) =>
    (NOT_A_NAME.test(a) || NOT_A_NAME.test(b)) ? m : '[name withheld]');
  return out.replace(/\s{2,}/g, ' ').trim();
}

function condense(text: string, maxWords = 55): string {
  const words = text.trim().split(/\s+/);
  return words.length <= maxWords ? text.trim() : `${words.slice(0, maxWords).join(' ')}…`;
}

function extractContacts(text: string): string[] {
  const found = new Set<string>();
  (text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).forEach((m) => found.add(m));
  (text.match(/(\+?27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g) ?? []).forEach((m) => found.add(m.trim()));
  (text.match(/\b(CAS|CASE|MAS)\s?\d+\/\d+\/\d+/gi) ?? []).forEach((m) => found.add(m));
  return [...found];
}

export interface SubmissionSummary {
  public: { module: string; title: string; summary: string; town: string; province: string; dateOccurred: string; severity: string };
  sensitive: { reporterName: string; reporterEmail: string; sapsNumber: string; contactsInText: string[] };
}

/**
 * Deterministic stand-in for the production AI summariser. It produces two separated
 * outputs from a submission:
 *  - `public`: PII stripped, condensed — the fields required for a map entry;
 *  - `sensitive`: reporter identity, contact and case references — admin eyes only.
 * It never invents information (spec §2.12); it only condenses and redacts what was submitted.
 * In production a free server-side model (e.g. Groq / Gemini free tier, key server-side)
 * writes the natural-language summary under the same PII-separation guardrails.
 */
export function summariseSubmission(sub: Submission): SubmissionSummary {
  return {
    public: {
      module: sub.module,
      title: sub.title,
      summary: condense(redact(sub.narrative, sub.reporter)),
      town: sub.town,
      province: sub.province,
      dateOccurred: sub.dateOccurred,
      severity: sub.severity,
    },
    sensitive: {
      reporterName: sub.reporter.replace(/\s*DEMO\s*/i, '').trim(),
      reporterEmail: sub.reporterEmail,
      sapsNumber: sub.sapsNumber,
      contactsInText: extractContacts(sub.narrative),
    },
  };
}
