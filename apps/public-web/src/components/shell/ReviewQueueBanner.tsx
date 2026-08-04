import { useNavigate } from 'react-router-dom';
import { useIncidentData } from '@/lib/hooks/useIncidentData';

/**
 * Surfaces, on the MAIN screen, every reason a stored record is not on the map.
 *
 * There are exactly two such reasons upstream of the time window, and both used
 * to be invisible:
 *
 *  1. AWAITING REVIEW. Every import path stamps `needsReview: true` on every
 *     record (AdminImport.tsx:953, :1032, :1650; incident-splitter.ts:609)
 *     because module and severity are always keyword guesses. `useIncidentData`
 *     withholds them, so immediately after any import the published count is
 *     exactly zero and the map is blank. Correct behaviour, terrible
 *     communication: a working map doing the right thing looked identical to a
 *     broken one.
 *
 *  2. MERGED AS DUPLICATES. Records sharing content + date + place collapse to
 *     one before publication. That count was computed by nobody and shown
 *     nowhere, while every total on screen was silently reduced by it. A
 *     historical farm-attack list — repeated short narratives, many undated
 *     rows — is exactly the input that triggers merges in bulk.
 *
 * `storedCount === totalCount + mergedCount + awaitingReview`, so between this
 * banner and the map's window disclosure every stored record is accounted for.
 */
export function ReviewQueueBanner() {
  const navigate = useNavigate();
  const { incidents, awaitingReview, mergedCount, storedCount, publishedImportedCount } = useIncidentData();

  if (awaitingReview === 0 && mergedCount === 0) return null;

  const n = awaitingReview;
  const plural = n === 1 ? '' : 's';
  // Loud treatment when NOTHING THE USER IMPORTED has reached the map — that is
  // the case they read as "the map is broken again".
  //
  // This used to test `allIncidents.length === 0`, which can never be true:
  // with Supabase unconfigured, fetchIncidents() falls back to 23 bundled demo
  // rows, so allIncidents is always populated and the loud branch was dead
  // code. The user would import 234 records, see 23 demo dots, and get only the
  // quiet one-liner. Test the imported set specifically.
  const blocking = awaitingReview > 0 && publishedImportedCount === 0;
  const go = () => navigate('/admin/import#review-queue');

  const mergeNote = mergedCount > 0 && (
    <div className="review-banner-text" data-kind="merged">
      <strong>{mergedCount}</strong> record{mergedCount === 1 ? '' : 's'} of the {storedCount} held
      {mergedCount === 1 ? ' was' : ' were'} merged away as duplicates before publishing — another
      record carried the same description, date and place. {mergedCount === 1 ? 'It is' : 'They are'} not
      counted in any total on this screen. Records with no description at all are never merged.
    </div>
  );

  // Merges only. Quiet, informational — nothing is broken and there is nothing
  // to release, but the number must still be visible or the totals lie.
  if (awaitingReview === 0) {
    return (
      <div className="review-banner" data-blocking={false} data-kind="merged" role="status">
        <div className="review-banner-body">{mergeNote}</div>
      </div>
    );
  }

  return (
    <div className="review-banner" data-blocking={blocking} role="status">
      <div className="review-banner-body">
        {blocking ? (
          <>
            <div className="review-banner-title">
              None of your {n} imported record{plural} {n === 1 ? 'is' : 'are'} on the map yet — {n === 1 ? 'it is' : 'they are'} waiting for you to confirm {n === 1 ? 'it' : 'them'}.
            </div>
            <div className="review-banner-text">
              Nothing from an import reaches the map until you release it. Every imported record
              carries at least one machine-derived field — module and severity are always keyword
              guesses — so all {n} {n === 1 ? 'is' : 'are'} held back. This is not a map fault and
              not a date filter.
              {incidents.length > 0 && ` The ${incidents.length} record${incidents.length === 1 ? '' : 's'} currently shown ${incidents.length === 1 ? 'is a' : 'are'} built-in sample${incidents.length === 1 ? '' : 's'}, not your import.`}
            </div>
            {/* The action button sits at the far right of the bar; on a wide
                monitor that is a long way from the words the user is reading, so
                name the route inline and make it clickable where their eye is. */}
            <div className="review-banner-text">
              <strong>Where to confirm:</strong>{' '}
              <button type="button" className="review-banner-inline" onClick={go}>
                Admin → Import → Stored Incidents → Review queue
              </button>
              {' '}— that link jumps straight to the block and highlights it. Press{' '}
              <em>“I have checked these — release {n} record{plural} to the map”</em>.
            </div>
          </>
        ) : (
          <div className="review-banner-text">
            <strong>{n}</strong> imported record{plural} {n === 1 ? 'is' : 'are'} held back pending your
            review. {n === 1 ? 'It is' : 'They are'} not on the map and {n === 1 ? 'is' : 'are'} not
            counted in any total on this screen. {incidents.length} record
            {incidents.length === 1 ? ' is' : 's are'} published. Confirm {n === 1 ? 'it' : 'them'} at{' '}
            <button type="button" className="review-banner-inline" onClick={go}>
              Admin → Import → Stored Incidents → Review queue
            </button>.
          </div>
        )}
        {mergeNote}
      </div>
      <button className="review-banner-action" onClick={go}>
        {blocking ? `Review and release ${n} record${plural}` : 'Review and release'}
      </button>
    </div>
  );
}
