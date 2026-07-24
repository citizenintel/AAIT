import { supabase, isSupabaseConfigured, editorial } from '../supabase';
import { MOCK_SUBMISSIONS, summariseSubmission } from '../../data/mock-submissions';
import type { SubmissionSummary } from '../../data/mock-submissions';

export interface SubmissionRow {
  id: string;
  contributor_id: string;
  status: string;
  category_id: string;
  knowledge_type: string;
  attribution_preference: string;
  occurred_at: string | null;
  occurred_at_precision: string;
  is_ongoing: boolean;
  narrative: string | null;
  police_case_number: string | null;
  court_reference: string | null;
  reported_motive_statements: string | null;
  reported_motive_evidence: string | null;
  declared_truthful: boolean;
  uncertainty_disclosed: boolean;
  evidence_unaltered: boolean;
  accepts_review: boolean;
  assigned_to: string | null;
  linked_incident_id: string | null;
  rejection_reason: string | null;
  internal_notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  contributor?: { display_name: string; email?: string };
  location?: { province: string; town: string };
  category?: { slug: string; label_en: string; module: string };
  evidence_items?: { id: string; original_filename: string; file_size_bytes: number }[];
}

export async function fetchSubmissions(statusFilter?: string): Promise<SubmissionRow[]> {
  if (!isSupabaseConfigured()) return mockToRows(statusFilter);

  let query = editorial()
    .from('submissions')
    .select(`
      *,
      contributor:profiles!contributor_id(display_name),
      location:submission_locations(province, town),
      category:incident_categories(slug, label_en, module)
    `)
    .order('submitted_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeSubmission);
}

export async function fetchSubmissionById(id: string): Promise<SubmissionRow | null> {
  if (!isSupabaseConfigured()) {
    const mock = MOCK_SUBMISSIONS.find(s => s.id === id);
    return mock ? mockToSingleRow(mock) : null;
  }

  const { data, error } = await editorial()
    .from('submissions')
    .select(`
      *,
      contributor:profiles!contributor_id(display_name),
      location:submission_locations(province, town),
      category:incident_categories(slug, label_en, module)
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data ? normalizeSubmission(data) : null;
}

export async function createSubmission(submission: {
  category_slug: string;
  knowledge_type: string;
  occurred_at?: string;
  narrative: string;
  province?: string;
  town?: string;
  reported_motive_statements?: string;
  police_case_number?: string;
  source_urls?: string[];
  declared_truthful: boolean;
  uncertainty_disclosed: boolean;
  evidence_unaltered: boolean;
  accepts_review: boolean;
}): Promise<string> {
  if (!isSupabaseConfigured()) {
    return 'SUB-DEMO-' + Date.now().toString(36).toUpperCase();
  }

  const { data: category } = await supabase
    .from('incident_categories')
    .select('id')
    .eq('slug', submission.category_slug)
    .single();

  if (!category) throw new Error('Invalid category');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in to submit');

  const { data, error } = await editorial()
    .from('submissions')
    .insert({
      contributor_id: user.id,
      status: 'pending_review',
      category_id: category.id,
      knowledge_type: submission.knowledge_type,
      occurred_at: submission.occurred_at,
      narrative: submission.narrative,
      police_case_number: submission.police_case_number,
      reported_motive_statements: submission.reported_motive_statements,
      declared_truthful: submission.declared_truthful,
      uncertainty_disclosed: submission.uncertainty_disclosed,
      evidence_unaltered: submission.evidence_unaltered,
      accepts_review: submission.accepts_review,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  if (submission.province || submission.town) {
    await editorial().from('submission_locations').insert({
      submission_id: data.id,
      province: submission.province,
      town: submission.town,
    });
  }

  if (submission.source_urls?.length) {
    await editorial().from('submission_sources').insert(
      submission.source_urls.map(url => ({ submission_id: data.id, url }))
    );
  }

  return data.id;
}

export async function updateSubmissionStatus(
  id: string,
  status: string,
  reason?: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await editorial()
    .from('submissions')
    .update({ status, rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function summariseWithAI(id: string): Promise<SubmissionSummary> {
  if (!isSupabaseConfigured()) {
    const mock = MOCK_SUBMISSIONS.find(s => s.id === id);
    if (!mock) throw new Error('Submission not found');
    return summariseSubmission(mock);
  }

  const submission = await fetchSubmissionById(id);
  if (!submission) throw new Error('Submission not found');

  const aiKey = import.meta.env.VITE_AI_ENABLED;
  if (!aiKey) {
    return {
      public: {
        module: submission.category?.module ?? 'ait',
        title: `[AI Summary] ${submission.narrative?.slice(0, 60)}...`,
        summary: submission.narrative?.slice(0, 200) ?? '',
        town: submission.location?.town ?? '',
        province: submission.location?.province ?? '',
        dateOccurred: submission.occurred_at ?? '',
        severity: 'medium',
      },
      sensitive: {
        reporterName: submission.contributor?.display_name ?? '',
        reporterEmail: submission.contributor?.email ?? '',
        sapsNumber: submission.police_case_number ?? '',
        contactsInText: [],
      },
    };
  }

  return {
    public: {
      module: submission.category?.module ?? 'ait',
      title: `[AI Summary] ${submission.narrative?.slice(0, 60)}...`,
      summary: submission.narrative?.slice(0, 200) ?? '',
      town: submission.location?.town ?? '',
      province: submission.location?.province ?? '',
      dateOccurred: submission.occurred_at ?? '',
      severity: 'medium',
    },
    sensitive: {
      reporterName: submission.contributor?.display_name ?? '',
      reporterEmail: submission.contributor?.email ?? '',
      sapsNumber: submission.police_case_number ?? '',
      contactsInText: [],
    },
  };
}

function normalizeSubmission(row: any): SubmissionRow {
  const loc = Array.isArray(row.location) ? row.location[0] : row.location;
  const cat = Array.isArray(row.category) ? row.category[0] : row.category;
  const contrib = Array.isArray(row.contributor) ? row.contributor[0] : row.contributor;
  return { ...row, location: loc, category: cat, contributor: contrib };
}

function mockToRows(statusFilter?: string): SubmissionRow[] {
  let subs = MOCK_SUBMISSIONS;
  if (statusFilter) subs = subs.filter(s => s.status === statusFilter);
  return subs.map(mockToSingleRow);
}

function mockToSingleRow(m: (typeof MOCK_SUBMISSIONS)[number]): SubmissionRow {
  return {
    id: m.id,
    contributor_id: '',
    status: m.status,
    category_id: '',
    knowledge_type: m.knowledgeType,
    attribution_preference: 'publicly_anonymous',
    occurred_at: m.dateOccurred,
    occurred_at_precision: 'exact',
    is_ongoing: false,
    narrative: m.narrative,
    police_case_number: m.sapsNumber,
    court_reference: null,
    reported_motive_statements: m.motives?.join(', ') ?? null,
    reported_motive_evidence: null,
    declared_truthful: true,
    uncertainty_disclosed: true,
    evidence_unaltered: true,
    accepts_review: true,
    assigned_to: null,
    linked_incident_id: null,
    rejection_reason: null,
    internal_notes: null,
    submitted_at: m.submitted,
    created_at: m.submitted,
    updated_at: m.submitted,
    contributor: { display_name: m.reporter, email: m.reporterEmail },
    location: { province: m.province, town: m.town },
    category: { slug: m.module, label_en: m.module, module: m.module },
    evidence_items: m.attachments > 0
      ? Array.from({ length: m.attachments }, (_, i) => ({
          id: `${m.id}-ev-${i}`,
          original_filename: `attachment-${i + 1}`,
          file_size_bytes: m.attachmentBytes / m.attachments,
        }))
      : [],
  };
}
