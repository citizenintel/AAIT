import type { MockIncident } from '@/data/mock-incidents';

const VERIFICATION_SCORES: Record<string, number> = {
  v0_unverified: 0,
  v1_triage: 2,
  v2_plausible_uncorroborated: 8,
  v3_corroborated: 15,
  v4_primary_source_confirmed: 22,
  v5_editorially_verified: 28,
};

export function calculateCredibility(inc: MockIncident): {
  score: number;
  level: string;
  colour: string;
  breakdown: { label: string; points: number; max: number }[];
} {
  const breakdown: { label: string; points: number; max: number }[] = [];

  const vScore = VERIFICATION_SCORES[inc.verification] ?? 0;
  breakdown.push({ label: 'Verification level', points: vScore, max: 28 });

  const evidenceCount = inc.evidence?.length ?? 0;
  const evidenceScore = Math.min(evidenceCount * 5, 20);
  breakdown.push({ label: 'Evidence items', points: evidenceScore, max: 20 });

  const hasPolice = inc.courtCase ? 12 : 0;
  breakdown.push({ label: 'Police/court ref', points: hasPolice, max: 12 });

  const hasSource = inc.sourceUrl ? 8 : 0;
  breakdown.push({ label: 'Source URL', points: hasSource, max: 8 });

  const hasWitness = (inc.reporterFirstName || inc.reporterSurname) ? 7 : 0;
  breakdown.push({ label: 'Reporter/witness', points: hasWitness, max: 7 });

  const hasVictim = (inc.victimFirstName || inc.victimSurname) ? 5 : 0;
  breakdown.push({ label: 'Victim identified', points: hasVictim, max: 5 });

  const hasDate = inc.dateOccurred ? 5 : 0;
  breakdown.push({ label: 'Date specified', points: hasDate, max: 5 });

  const hasLocation = inc.town ? 5 : 0;
  breakdown.push({ label: 'Location specified', points: hasLocation, max: 5 });

  const hasCasualties = (inc.casualties?.deceased ?? 0) > 0 || (inc.casualties?.injured ?? 0) > 0 ? 5 : 0;
  breakdown.push({ label: 'Casualties documented', points: hasCasualties, max: 5 });

  const hasSummary = (inc.summary?.length ?? 0) > 50 ? 5 : 0;
  breakdown.push({ label: 'Detailed notes', points: hasSummary, max: 5 });

  const score = Math.min(100, vScore + evidenceScore + hasPolice + hasSource + hasWitness + hasVictim + hasDate + hasLocation + hasCasualties + hasSummary);

  let level: string;
  let colour: string;
  if (score >= 80) { level = 'Verified'; colour = '#38b2ac'; }
  else if (score >= 60) { level = 'Strong'; colour = '#48bb78'; }
  else if (score >= 40) { level = 'Moderate'; colour = '#4299e1'; }
  else if (score >= 20) { level = 'Limited'; colour = '#ecc94b'; }
  else { level = 'Unconfirmed'; colour = '#a0aec0'; }

  return { score, level, colour, breakdown };
}
