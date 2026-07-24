'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConfidenceAnatomy as ConfidenceAnatomyType, ConfidenceLevel } from '@/types/ontology';

// ---------------------------------------------------------------------------
// Confidence calculation helper
// ---------------------------------------------------------------------------

const WEIGHTS = {
  sourceIndependence: 0.25,
  officialCorroboration: 0.20,
  locationConfidence: 0.15,
  timeConfidence: 0.10,
  mediaAuthenticity: 0.10,
  classification: 0.10,
  contradictionPenalty: 0.10,
} as const;

export function calculateConfidence(
  input: Omit<ConfidenceAnatomyType, 'overall' | 'level'>,
): ConfidenceAnatomyType {
  const overall =
    input.sourceIndependence * WEIGHTS.sourceIndependence +
    input.officialCorroboration * WEIGHTS.officialCorroboration +
    input.locationConfidence * WEIGHTS.locationConfidence +
    input.timeConfidence * WEIGHTS.timeConfidence +
    input.mediaAuthenticity * WEIGHTS.mediaAuthenticity +
    input.classification * WEIGHTS.classification +
    input.contradictionPenalty * WEIGHTS.contradictionPenalty;

  let level: ConfidenceLevel;

  if (input.contradictionPenalty < -50) {
    level = 'disputed';
  } else if (overall >= 85) {
    level = 'verified';
  } else if (overall >= 70) {
    level = 'strongly_corroborated';
  } else if (overall >= 50) {
    level = 'partially_corroborated';
  } else if (overall >= 30) {
    level = 'unconfirmed';
  } else if (overall >= 10) {
    level = 'insufficient_evidence';
  } else {
    level = 'false_or_withdrawn';
  }

  return { ...input, overall, level };
}

// ---------------------------------------------------------------------------
// Row definitions
// ---------------------------------------------------------------------------

interface RowDef {
  key: keyof Omit<ConfidenceAnatomyType, 'overall' | 'level'>;
  label: string;
  explanation: string;
}

const ROWS: RowDef[] = [
  {
    key: 'sourceIndependence',
    label: 'Source Independence',
    explanation:
      'Measures how many genuinely independent sources confirm this claim. High scores mean multiple unrelated outlets reported the same facts, reducing the chance of a single-source fabrication or echo.',
  },
  {
    key: 'locationConfidence',
    label: 'Location Confidence',
    explanation:
      'How precisely we can place this event geographically. A high score means we have GPS coordinates or a confirmed address; a low score means only a vague region or province-level reference.',
  },
  {
    key: 'timeConfidence',
    label: 'Time Confidence',
    explanation:
      'How precisely we know when this event occurred. High scores indicate timestamps from official records or sensor data; low scores mean only approximate or contradictory time references.',
  },
  {
    key: 'mediaAuthenticity',
    label: 'Media Authenticity',
    explanation:
      'Whether associated photos, videos, or documents have been verified as genuine. Checks include metadata analysis, reverse image search, and geolocation matching against claimed location.',
  },
  {
    key: 'classification',
    label: 'Classification',
    explanation:
      'Confidence in the event type classification itself. A high score means the event clearly fits its category; a low score means it could be reclassified as more information emerges.',
  },
  {
    key: 'officialCorroboration',
    label: 'Official Corroboration',
    explanation:
      'Whether official sources (government, police, utility companies) have confirmed the event. Official corroboration significantly raises overall confidence but its absence alone does not invalidate community reports.',
  },
  {
    key: 'contradictionPenalty',
    label: 'Contradiction Penalty',
    explanation:
      'A negative score applied when sources actively contradict each other on material facts. A penalty below -50 forces the overall assessment to "disputed" regardless of other scores.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBarRange(value: number): string {
  if (value < 0) return 'negative';
  if (value >= 80) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

function formatLevel(level: ConfidenceLevel): string {
  return level
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConfidenceAnatomyProps {
  confidence: ConfidenceAnatomyType;
  mode: 'full' | 'compact';
}

export default function ConfidenceAnatomy({ confidence, mode }: ConfidenceAnatomyProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (mode === 'compact') {
    return (
      <span
        className="confidence-badge"
        data-level={confidence.level}
        title={formatLevel(confidence.level)}
      >
        <span className="confidence-badge-dot" />
        <span className="confidence-badge-score">{Math.round(confidence.overall)}</span>
      </span>
    );
  }

  return (
    <div className="confidence-anatomy">
      {/* Overall badge */}
      <div className="confidence-badge" data-level={confidence.level}>
        <span className="confidence-badge-dot" />
        <span>{formatLevel(confidence.level)}</span>
        <span className="confidence-badge-score">{Math.round(confidence.overall)}</span>
      </div>

      {/* Dimension rows */}
      {ROWS.map((row) => {
        const value = confidence[row.key];
        const absValue = Math.abs(value);
        const isExpanded = expandedRow === row.key;

        return (
          <div key={row.key}>
            <div
              className="confidence-row"
              onClick={() => setExpandedRow(isExpanded ? null : row.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedRow(isExpanded ? null : row.key);
                }
              }}
            >
              <span className="confidence-row-label">{row.label}</span>
              <div className="confidence-bar-track">
                <motion.div
                  className="confidence-bar-fill"
                  data-range={getBarRange(value)}
                  initial={{ width: 0 }}
                  animate={{ width: `${absValue}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <span className="confidence-row-value">{value}</span>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  className="confidence-explanation"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {row.explanation}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
