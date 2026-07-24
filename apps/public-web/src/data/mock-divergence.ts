import type { NarrativeDivergence } from '@/types/ontology';

export const MOCK_DIVERGENCE: NarrativeDivergence = {
  eventId: 'evt-003',
  sourceGroups: [
    {
      type: 'official',
      label: 'Rand Water / Government',
      emphasis: 'Technical pump failure being addressed through emergency maintenance. Partial restoration underway. Water tankers deployed to priority areas.',
      sources: ['Rand Water media statement', 'Gauteng Premier office', 'DWS spokesperson'],
    },
    {
      type: 'community',
      label: 'Johannesburg Residents',
      emphasis: 'Five days without water in some areas. No tankers have arrived despite promises. Elderly and disabled residents cannot collect water from distant points. This is a recurring crisis, not a new incident.',
      sources: ['Community WhatsApp groups', 'Ward councillor reports', 'Civic organizations'],
    },
    {
      type: 'national_media',
      label: 'South African Media',
      emphasis: 'Infrastructure collapse. Zuikerbosch station has been flagged as a single point of failure for years. Hospitals activating emergency protocols. Government accountability questions.',
      sources: ['News24', 'eNCA', 'Daily Maverick', 'TimesLIVE'],
    },
    {
      type: 'international_media',
      label: 'International Coverage',
      emphasis: 'South Africa infrastructure crisis worsens. Water failure follows energy crisis pattern. Emerging market investment risk. Comparison to other developing countries facing similar infrastructure decay.',
      sources: ['Reuters', 'BBC Africa', 'Al Jazeera', 'Financial Times'],
    },
  ],
  commonFacts: [
    'Pump failure occurred at Rand Water Zuikerbosch station',
    'Johannesburg and parts of Ekurhuleni affected',
    'Water pressure dropped significantly across affected areas',
    'Hospitals activated emergency water reserves',
    'Rand Water acknowledged the failure and is working on restoration',
  ],
  exclusiveClaims: [
    {
      claim: 'Water tankers have been deployed to 47 priority sites across Johannesburg.',
      sourceGroup: 'official',
      contradicted: true,
      verifiedLater: false,
    },
    {
      claim: 'No water tankers arrived in Soweto, Diepkloof, or Orange Farm despite 3 days of promises.',
      sourceGroup: 'community',
      contradicted: false,
      verifiedLater: true,
    },
    {
      claim: 'The failure was caused by copper cable theft at the pump station.',
      sourceGroup: 'national_media',
      contradicted: true,
      verifiedLater: false,
    },
    {
      claim: 'The pump station had been flagged for emergency maintenance in a 2024 audit report that was never acted upon.',
      sourceGroup: 'national_media',
      contradicted: false,
      verifiedLater: true,
    },
    {
      claim: 'South Africa may face a Cape Town "Day Zero" scenario for Johannesburg within 5 years.',
      sourceGroup: 'international_media',
      contradicted: false,
      verifiedLater: false,
    },
  ],
  terminologyDifferences: {
    'the incident': {
      official: 'temporary disruption',
      community: 'crisis',
      national_media: 'infrastructure failure',
      international_media: 'collapse',
    },
    'affected population': {
      official: 'some residents in affected areas',
      community: 'millions of people',
      national_media: '12 million people served by Zuikerbosch',
      international_media: 'the population of Africa\'s economic hub',
    },
    'timeline': {
      official: 'restoration is underway',
      community: 'we have been without water for 5 days',
      national_media: 'crisis entering its fifth day',
      international_media: 'ongoing infrastructure decay',
    },
  },
  casualtyDiscrepancies: {
    'deaths attributed to water crisis': {
      official: 0,
      community: 3,
      national_media: 1,
      international_media: 0,
    },
  },
  correctedClaims: [
    {
      original: 'Pump failure caused by load shedding',
      corrected: 'Pump failure was mechanical — unrelated to load shedding, though load shedding complicated the repair process',
      correctedAt: new Date('2026-07-22T08:00:00Z'),
      correctedBy: 'Rand Water engineering team',
    },
    {
      original: 'All 4 pumps failed simultaneously',
      corrected: 'Pump 1 failed mechanically; Pumps 2-3 were taken offline for safety inspection; Pump 4 was already offline for scheduled maintenance',
      correctedAt: new Date('2026-07-22T06:00:00Z'),
      correctedBy: 'Rand Water technical briefing',
    },
  ],
  coordinatedWording: 'Three separate government spokespeople used the phrase "temporary disruption to water services" within 30 minutes — suggesting coordinated communications rather than independent assessment.',
};
