import { supabase, isSupabaseConfigured, evidence } from '../supabase';

export interface EvidenceRow {
  id: string;
  submission_id: string | null;
  incident_id: string | null;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  status: string;
  sha256_hash: string | null;
  created_at: string;
}

export async function uploadEvidence(
  file: File,
  submissionId: string,
): Promise<EvidenceRow> {
  if (!isSupabaseConfigured()) throw new Error('Database not configured');

  const maxBytes = Number(import.meta.env.VITE_MAX_UPLOAD_BYTES ?? 1048576);
  if (file.size > maxBytes) {
    throw new Error(`File exceeds ${(maxBytes / 1024 / 1024).toFixed(0)} MB limit`);
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${submissionId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('evidence-quarantine')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const { data, error } = await evidence()
    .from('evidence_items')
    .insert({
      submission_id: submissionId,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      storage_path: storagePath,
      status: 'quarantined',
      sha256_hash: hashHex,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchEvidenceForSubmission(submissionId: string): Promise<EvidenceRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await evidence()
    .from('evidence_items')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchEvidenceForIncident(incidentId: string): Promise<EvidenceRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await evidence()
    .from('evidence_items')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('is_approved_public', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function getPublicUrl(storagePath: string, bucket = 'evidence-quarantine'): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}
