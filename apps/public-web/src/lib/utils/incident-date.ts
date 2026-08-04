/**
 * Compatibility barrel.
 *
 * The approved design document refers to this module as `incident-date`; the
 * implementation lives in `time-filter.ts`. Both import paths resolve to the
 * same single implementation — there is no second copy of the normaliser.
 *
 * Prefer importing from '@/lib/utils/time-filter' in new code.
 */
export * from './time-filter';
