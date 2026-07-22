export interface NewsItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  module: 'ait' | 'unrest' | 'bias' | 'infrastructure' | 'natural' | 'general' | 'traffic';
  snippet: string;
  isSynthetic: true;
}

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'news-001',
    title: 'Farm attacks in Limpopo spike 34% year-on-year — TAU SA report',
    source: 'Netwerk24',
    sourceUrl: '#',
    publishedAt: '2026-07-22T06:30:00Z',
    module: 'ait',
    snippet: 'TAU SA released their mid-year report showing a significant increase in farm attacks in Limpopo province compared to the same period last year.',
    isSynthetic: true,
  },
  {
    id: 'news-002',
    title: 'Service delivery protests block N1 highway near Musina',
    source: 'eNCA',
    sourceUrl: '#',
    publishedAt: '2026-07-22T04:15:00Z',
    module: 'unrest',
    snippet: 'Residents of communities near Musina have blockaded the N1 highway demanding water and electricity. Traffic backed up for 8km.',
    isSynthetic: true,
  },
  {
    id: 'news-003',
    title: 'Eskom announces Stage 4 loadshedding from Wednesday',
    source: 'Business Day',
    sourceUrl: '#',
    publishedAt: '2026-07-21T18:00:00Z',
    module: 'infrastructure',
    snippet: 'Eskom confirmed escalation to Stage 4 loadshedding due to unplanned breakdowns at Medupi and Kusile power stations.',
    isSynthetic: true,
  },
  {
    id: 'news-004',
    title: 'SAHRC condemns hate speech pamphlets distributed in Johannesburg',
    source: 'Daily Maverick',
    sourceUrl: '#',
    publishedAt: '2026-07-21T14:45:00Z',
    module: 'bias',
    snippet: 'The South African Human Rights Commission has launched an investigation into inflammatory pamphlets targeting foreign nationals in Diepsloot.',
    isSynthetic: true,
  },
  {
    id: 'news-005',
    title: 'Western Cape wildfire season: three farms destroyed in Overberg',
    source: 'Cape Argus',
    sourceUrl: '#',
    publishedAt: '2026-07-20T16:20:00Z',
    module: 'natural',
    snippet: 'Runaway veld fires in the Overberg district have destroyed three farmsteads and approximately 800 hectares of grazing land.',
    isSynthetic: true,
  },
  {
    id: 'news-006',
    title: 'Police arrest 14 in connection with Mamelodi shopping centre looting',
    source: 'Pretoria News',
    sourceUrl: '#',
    publishedAt: '2026-07-21T15:00:00Z',
    module: 'unrest',
    snippet: 'SAPS confirmed 14 arrests following mass looting at Mamelodi Crossing. Damaged estimated at over R2 million.',
    isSynthetic: true,
  },
  {
    id: 'news-007',
    title: 'Bronkhorstspruit farmer killed in overnight attack',
    source: 'Maroela Media',
    sourceUrl: '#',
    publishedAt: '2026-07-21T08:00:00Z',
    module: 'ait',
    snippet: 'A 62-year-old farmer was fatally shot during an armed robbery at his homestead near Bronkhorstspruit. His wife survived and raised the alarm.',
    isSynthetic: true,
  },
  {
    id: 'news-008',
    title: 'Graaff-Reinet dam levels critical — 50L daily limit imposed',
    source: 'Midland News',
    sourceUrl: '#',
    publishedAt: '2026-07-19T11:30:00Z',
    module: 'natural',
    snippet: 'The Nqweba Dam has dropped below 15% capacity. Residents face strict water rationing as agricultural losses mount.',
    isSynthetic: true,
  },
  {
    id: 'news-009',
    title: 'Copper cable theft leaves Lephalale without cell service for 48 hours',
    source: 'Modimolle News',
    sourceUrl: '#',
    publishedAt: '2026-07-22T07:00:00Z',
    module: 'infrastructure',
    snippet: 'Vodacom tower near Lephalale stripped of copper and batteries — third incident at this location in six months.',
    isSynthetic: true,
  },
  {
    id: 'news-010',
    title: 'Stellenbosch land occupation attempt: court interdict granted',
    source: 'Die Burger',
    sourceUrl: '#',
    publishedAt: '2026-07-18T14:00:00Z',
    module: 'ait',
    snippet: 'A group of approximately 200 people attempted to occupy vacant land on a wine estate. Private security and SAPS prevented the occupation.',
    isSynthetic: true,
  },
  {
    id: 'news-011',
    title: 'Taxi violence in Nyanga claims two lives',
    source: 'GroundUp',
    sourceUrl: '#',
    publishedAt: '2026-07-20T13:45:00Z',
    module: 'unrest',
    snippet: 'Two people killed and three wounded in a taxi shootout on the N2 near Nyanga. Ongoing route dispute between rival associations.',
    isSynthetic: true,
  },
  {
    id: 'news-012',
    title: 'AgriSA calls for national rural safety summit',
    source: 'Rapport',
    sourceUrl: '#',
    publishedAt: '2026-07-19T09:00:00Z',
    module: 'general',
    snippet: 'AgriSA president calls for an urgent national summit on rural safety, citing a deteriorating security situation across multiple provinces.',
    isSynthetic: true,
  },
  {
    id: 'news-013',
    title: 'Multi-vehicle pile-up closes N1 southbound near Beaufort West',
    source: 'News24',
    sourceUrl: '#',
    publishedAt: '2026-07-22T05:40:00Z',
    module: 'traffic',
    snippet: 'A six-vehicle collision involving two trucks has closed the N1 southbound between Three Sisters and Beaufort West. Emergency services on scene. Diversions via the R61.',
    isSynthetic: true,
  },
  {
    id: 'news-014',
    title: 'R21 closed after tanker rollover near OR Tambo — hazmat deployed',
    source: 'SABC News',
    sourceUrl: '#',
    publishedAt: '2026-07-22T03:20:00Z',
    module: 'traffic',
    snippet: 'A fuel tanker overturned on the R21 near OR Tambo International, forcing a full road closure. Hazmat crews are containing a diesel spill. Expect delays of 2+ hours.',
    isSynthetic: true,
  },
  {
    id: 'news-015',
    title: 'N3 Harrismith: road closed due to overnight snowfall',
    source: 'IOL',
    sourceUrl: '#',
    publishedAt: '2026-07-21T22:00:00Z',
    module: 'traffic',
    snippet: 'Heavy snowfall between Harrismith and Van Reenen has closed the N3. Stranded trucks line the roadside. Motorists advised to use the N1 alternative route.',
    isSynthetic: true,
  },
  {
    id: 'news-016',
    title: 'Hit-and-run on M1 Johannesburg leaves cyclist dead',
    source: 'eNCA',
    sourceUrl: '#',
    publishedAt: '2026-07-21T19:30:00Z',
    module: 'traffic',
    snippet: 'JMPD is investigating a fatal hit-and-run on the M1 near the Corlett Drive offramp. The vehicle fled the scene. Dashcam footage sought.',
    isSynthetic: true,
  },
];

// Displayed as plain text (never a link) so readers stay on-site.
const SOURCE_DOMAINS: Record<string, string> = {
  'Netwerk24': 'netwerk24.com',
  'eNCA': 'enca.com',
  'Business Day': 'businesslive.co.za',
  'Daily Maverick': 'dailymaverick.co.za',
  'Cape Argus': 'iol.co.za',
  'Pretoria News': 'iol.co.za',
  'Maroela Media': 'maroelamedia.co.za',
  'Midland News': 'midlandsnews.co.za',
  'Modimolle News': 'modimollenews.co.za',
  'Die Burger': 'netwerk24.com',
  'GroundUp': 'groundup.org.za',
  'Rapport': 'netwerk24.com',
  'News24': 'news24.com',
  'SABC News': 'sabcnews.com',
  'IOL': 'iol.co.za',
  'TAU SA': 'tausa.co.za',
  'AfriForum': 'afriforum.co.za',
  'Internet Archive': 'web.archive.org',
};

/** The source's web address as display text (no hyperlink). */
export function sourceDomain(source: string): string {
  return SOURCE_DOMAINS[source] ?? `${source.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.za`;
}

export interface RssFeedConfig {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  lastFetched: string | null;
  articleCount: number;
}

export const MOCK_RSS_FEEDS: RssFeedConfig[] = [
  { id: 'rss-001', name: 'News24 — Crime', url: 'https://feeds.news24.com/articles/news24/SouthAfrica/Crime/rss', category: 'crime', enabled: true, lastFetched: '2026-07-22T15:00:00Z', articleCount: 342 },
  { id: 'rss-002', name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/article/feed/', category: 'general', enabled: true, lastFetched: '2026-07-22T14:30:00Z', articleCount: 1205 },
  { id: 'rss-003', name: 'GroundUp', url: 'https://www.groundup.org.za/rss/', category: 'civil-rights', enabled: true, lastFetched: '2026-07-22T13:00:00Z', articleCount: 890 },
  { id: 'rss-004', name: 'Netwerk24', url: 'https://www.netwerk24.com/rss', category: 'afrikaans-media', enabled: true, lastFetched: '2026-07-22T14:45:00Z', articleCount: 567 },
  { id: 'rss-005', name: 'Maroela Media', url: 'https://maroelamedia.co.za/feed/', category: 'afrikaans-media', enabled: true, lastFetched: '2026-07-22T12:00:00Z', articleCount: 423 },
  { id: 'rss-006', name: 'SABC News', url: 'https://www.sabcnews.com/sabcnews/feed/', category: 'broadcast', enabled: true, lastFetched: '2026-07-22T15:15:00Z', articleCount: 2100 },
  { id: 'rss-007', name: 'IOL — Crime & Courts', url: 'https://www.iol.co.za/rss/crime-courts', category: 'crime', enabled: true, lastFetched: '2026-07-22T14:00:00Z', articleCount: 780 },
  { id: 'rss-008', name: 'eNCA', url: 'https://www.enca.com/rss', category: 'broadcast', enabled: false, lastFetched: '2026-07-21T10:00:00Z', articleCount: 156 },
  { id: 'rss-009', name: 'Rapport', url: 'https://www.rapport.co.za/rss', category: 'afrikaans-media', enabled: true, lastFetched: '2026-07-22T11:00:00Z', articleCount: 312 },
  { id: 'rss-010', name: 'Internet Archive — FarmiTracker', url: 'https://web.archive.org/web/*/farmitracker.co.za/*', category: 'archive', enabled: true, lastFetched: '2026-07-20T00:00:00Z', articleCount: 48 },
  { id: 'rss-011', name: 'TAU SA', url: 'https://tausa.co.za/feed/', category: 'agricultural', enabled: true, lastFetched: '2026-07-22T09:00:00Z', articleCount: 89 },
  { id: 'rss-012', name: 'AfriForum', url: 'https://www.afriforum.co.za/feed/', category: 'civil-rights', enabled: true, lastFetched: '2026-07-22T10:30:00Z', articleCount: 245 },
];
