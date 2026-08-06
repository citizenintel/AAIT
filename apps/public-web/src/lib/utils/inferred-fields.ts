/**
 * Canonical vocabulary for `MockIncident.inferredFields`.
 *
 * An entry in `inferredFields` is a promise to the reader: "this value was
 * produced by machine, the source did not state it." That promise is only worth
 * anything if something READS the flags, so every writer must use a key from
 * this table and every surface that shows an incident must render the label.
 *
 * Readers:
 *  - components/IncidentDetail.tsx        (public incident panel)
 *  - pages/admin/AdminImport.tsx          (import provenance panel)
 */
export const INFERRED_FIELD_LABELS: Record<string, string> = {
  // --- splitter ---
  'town:inherited': 'Town — copied from the parent record, not stated in this entry',
  'coords:inherited': 'Map position — copied from the parent record, not derived from this entry',
  'coords:unresolved': 'Map position — could not be resolved; no position is claimed',
  'date:inherited': 'Date — copied from the parent record, not stated in this entry',
  'casualties:unassigned': 'Casualties — the parent record carried a figure that has NOT been assigned to this entry',
  'casualties:from-summary': 'Casualties — read from a number written in the summary text, not from a source column',
  'entries:capped': 'This record holds the leftover text of a source row that exceeded the per-row split cap',
  'title:structural': 'Title — generated from place and date; the source supplied no usable title',
  'victimSurname:extracted': 'Victim name — pattern-matched out of the summary text, not read from a source column',

  // --- import ---
  'module:unclassified': 'Category — no keyword matched; the record is deliberately left unclassified',
  'module:keyword-guess': 'Category — guessed from keywords in the text, not stated by the source',
  'severity:unassessed': 'Severity — no keyword matched; no severity is claimed',
  'severity:keyword-guess': 'Severity — guessed from keywords in the text, not stated by the source',
  'province:from-text': 'Province — found by scanning the row text, not read from a mapped column',
  'coords:from-town': 'Map position — town centroid from the built-in gazetteer, not a surveyed position',
  'coords:from-province': 'Map position — province centroid only; accurate to the province, not the place',
  'date:missing': 'Date — the source stated none; the field is deliberately blank',
  'town:missing': 'Location — the source stated none; the field is deliberately blank',
  'victimSurname:from-text': 'Victim name — pattern-matched out of document text, not read from a source column',
  'casualties:from-text': 'Casualties — read from a number written in the document text',
  'summary:from-document': 'Summary — a raw text chunk lifted from a PDF/DOCX, not a source-supplied field',
};

/** Human-readable label for one flag; falls back to the raw key. */
export function inferredFieldLabel(key: string): string {
  return INFERRED_FIELD_LABELS[key] ?? key;
}
