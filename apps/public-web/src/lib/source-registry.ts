import type { SourceAdapter, SourceHealthCheck } from '@/types/ontology';

export const SOURCE_REGISTRY: SourceAdapter[] = [
  {
    id: 'acled',
    provider: 'Armed Conflict Location & Event Data Project (ACLED)',
    licenseStatus: 'free_restricted',
    permittedUse: 'Research and non-commercial analysis',
    commercialRestrictions: ['Commercial use requires written agreement with ACLED'],
    rateLimit: { requests: 500, window: 'day' },
    coverageArea: 'Global — Africa, Middle East, South/Southeast Asia, Europe, Americas',
    updateFrequency: 'Weekly (Friday release)',
    lastSuccessfulRetrieval: null,
    expectedLatency: 2000,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 85,
    healthStatus: 'unknown',
    requiresLicense: true,
    licenseNotes: 'Free for research/non-commercial. Commercial use requires written agreement. Register at acleddata.com.',
  },
  {
    id: 'gdelt',
    provider: 'Global Database of Events, Language, and Tone (GDELT)',
    licenseStatus: 'open',
    permittedUse: 'Unrestricted',
    commercialRestrictions: [],
    rateLimit: null,
    coverageArea: 'Global — 200+ countries, 100+ languages',
    updateFrequency: 'Every 15 minutes',
    lastSuccessfulRetrieval: null,
    expectedLatency: 3000,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 60,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'Fully open. Based on media monitoring — high volume, variable quality. Best used for trend detection, not individual event verification.',
  },
  {
    id: 'aisstream',
    provider: 'AISStream',
    licenseStatus: 'free_restricted',
    permittedUse: 'Non-commercial maritime tracking',
    commercialRestrictions: ['Web applications must consume stream via own backend, not direct browser connection'],
    rateLimit: null,
    coverageArea: 'Global coastal waters — coverage varies by receiver density',
    updateFrequency: 'Real-time (streaming)',
    lastSuccessfulRetrieval: null,
    expectedLatency: 500,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 70,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'Web applications must consume stream via own backend, not direct browser connection. Coverage limited by coastal receiver availability.',
  },
  {
    id: 'opensky',
    provider: 'OpenSky Network',
    licenseStatus: 'free_restricted',
    permittedUse: 'Research and non-commercial',
    commercialRestrictions: ['Operational integration into a live product requires written licence'],
    rateLimit: { requests: 100, window: '5min' },
    coverageArea: 'Global — best coverage over Europe and North America',
    updateFrequency: 'Real-time (5-second updates)',
    lastSuccessfulRetrieval: null,
    expectedLatency: 1500,
    observedLatency: 0,
    fallbackSource: 'adsb-exchange',
    confidenceContribution: 80,
    healthStatus: 'unknown',
    requiresLicense: true,
    licenseNotes: 'CRITICAL: Operational integration into a live product requires written licence, even for non-profit projects. Contact opensky-network.org before deploying.',
  },
  {
    id: 'adsb-exchange',
    provider: 'ADS-B Exchange',
    licenseStatus: 'free_restricted',
    permittedUse: 'Non-commercial use with attribution',
    commercialRestrictions: ['Commercial use requires API subscription'],
    rateLimit: { requests: 100, window: 'min' },
    coverageArea: 'Global — community-fed ADS-B receivers',
    updateFrequency: 'Real-time',
    lastSuccessfulRetrieval: null,
    expectedLatency: 1000,
    observedLatency: 0,
    fallbackSource: 'opensky',
    confidenceContribution: 75,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'Unfiltered ADS-B data — includes military and government aircraft that other sources may hide. Community-sourced.',
  },
  {
    id: 'nasa-firms',
    provider: 'NASA Fire Information for Resource Management System (FIRMS)',
    licenseStatus: 'open',
    permittedUse: 'Unrestricted — US Government public domain',
    commercialRestrictions: [],
    rateLimit: null,
    coverageArea: 'Global',
    updateFrequency: 'Every 3 hours (VIIRS/MODIS)',
    lastSuccessfulRetrieval: null,
    expectedLatency: 2000,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 90,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'US Government public domain. Free API key from earthdata.nasa.gov. Near real-time fire detection via satellite.',
  },
  {
    id: 'usgs-earthquakes',
    provider: 'US Geological Survey Earthquake Hazards Program',
    licenseStatus: 'open',
    permittedUse: 'Unrestricted — US Government public domain',
    commercialRestrictions: [],
    rateLimit: null,
    coverageArea: 'Global',
    updateFrequency: 'Every minute',
    lastSuccessfulRetrieval: null,
    expectedLatency: 800,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 95,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'GeoJSON feed updated every minute. Highest reliability of any source in this registry.',
  },
  {
    id: 'finnhub',
    provider: 'Finnhub Stock API',
    licenseStatus: 'free_restricted',
    permittedUse: 'Non-commercial with free tier',
    commercialRestrictions: ['Real-time data requires paid plan', '15-minute delay on free tier'],
    rateLimit: { requests: 60, window: 'min' },
    coverageArea: 'Global equities, forex, crypto',
    updateFrequency: 'Real-time (paid) / 15-min delay (free)',
    lastSuccessfulRetrieval: null,
    expectedLatency: 500,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 75,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'Free tier: 60 calls/min, 15-min delay. Real-time requires paid plan.',
  },
  {
    id: 'polymarket',
    provider: 'Polymarket',
    licenseStatus: 'open',
    permittedUse: 'Unrestricted API access',
    commercialRestrictions: [],
    rateLimit: null,
    coverageArea: 'Global prediction markets',
    updateFrequency: 'Real-time',
    lastSuccessfulRetrieval: null,
    expectedLatency: 1000,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 40,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'Leading indicator only, NOT verified intelligence. Volume and manipulation risks apply. Useful for sentiment, not facts.',
  },
  {
    id: 'copernicus',
    provider: 'Copernicus Sentinel (ESA)',
    licenseStatus: 'open',
    permittedUse: 'Unrestricted — ESA open data policy',
    commercialRestrictions: [],
    rateLimit: null,
    coverageArea: 'Global satellite imagery',
    updateFrequency: 'Daily (varies by orbit)',
    lastSuccessfulRetrieval: null,
    expectedLatency: 5000,
    observedLatency: 0,
    fallbackSource: null,
    confidenceContribution: 85,
    healthStatus: 'unknown',
    requiresLicense: false,
    licenseNotes: 'ESA open data. Sentinel-1 (SAR), Sentinel-2 (optical), Sentinel-5P (atmospheric). Registration required at scihub.copernicus.eu.',
  },
];

const HEALTH_ENDPOINTS: Record<string, string> = {
  'acled': 'https://api.acleddata.com/acled/read',
  'gdelt': 'https://api.gdeltproject.org/api/v2/doc/doc',
  'usgs-earthquakes': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  'nasa-firms': 'https://firms.modaps.eosdis.nasa.gov/api/area',
  'finnhub': 'https://finnhub.io/api/v1/quote',
};

export async function checkSourceHealth(adapter: SourceAdapter): Promise<SourceHealthCheck> {
  const endpoint = HEALTH_ENDPOINTS[adapter.id];
  if (!endpoint) {
    return {
      sourceId: adapter.id,
      isHealthy: adapter.healthStatus !== 'down',
      latencyMs: 0,
      dataAge: adapter.lastSuccessfulRetrieval,
    };
  }

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(endpoint, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors',
    });
    clearTimeout(timeout);
    const latency = Math.round(performance.now() - start);

    return {
      sourceId: adapter.id,
      isHealthy: response.ok || response.type === 'opaque',
      latencyMs: latency,
      dataAge: new Date(),
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      sourceId: adapter.id,
      isHealthy: false,
      latencyMs: latency,
      dataAge: adapter.lastSuccessfulRetrieval,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function checkAllSourceHealth(): Promise<{
  overall: 'healthy' | 'degraded' | 'critical';
  checks: SourceHealthCheck[];
  healthyCount: number;
  totalCount: number;
}> {
  const checks = await Promise.allSettled(
    SOURCE_REGISTRY.map((adapter) => checkSourceHealth(adapter)),
  );

  const results: SourceHealthCheck[] = checks.map((result, i) =>
    result.status === 'fulfilled'
      ? result.value
      : {
          sourceId: SOURCE_REGISTRY[i]!.id,
          isHealthy: false,
          latencyMs: 0,
          dataAge: null,
          errorMessage: result.reason?.message ?? 'Promise rejected',
        },
  );

  const healthyCount = results.filter((c) => c.isHealthy).length;
  const totalCount = results.length;
  const ratio = totalCount > 0 ? healthyCount / totalCount : 0;

  return {
    overall: ratio >= 0.8 ? 'healthy' : ratio >= 0.5 ? 'degraded' : 'critical',
    checks: results,
    healthyCount,
    totalCount,
  };
}
