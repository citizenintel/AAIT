import * as duckdb from '@duckdb/duckdb-wasm';
import type { IntelligenceEvent, InfrastructureAsset } from '@/types/ontology';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function initAnalyticsEngine(): Promise<void> {
  if (db) return;

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();

  await conn.query(`INSTALL h3 FROM community; LOAD h3;`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR PRIMARY KEY,
      type VARCHAR,
      title VARCHAR,
      lat DOUBLE,
      lng DOUBLE,
      h3_res4 VARCHAR,
      h3_res6 VARCHAR,
      h3_res8 VARCHAR,
      timestamp TIMESTAMP,
      reported_at TIMESTAMP,
      confidence_overall DOUBLE,
      confidence_level VARCHAR,
      source_count INTEGER,
      status VARCHAR,
      change_from_baseline DOUBLE,
      acceleration_rate DOUBLE,
      novelty DOUBLE,
      population_exposed INTEGER
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id VARCHAR PRIMARY KEY,
      type VARCHAR,
      name VARCHAR,
      lat DOUBLE,
      lng DOUBLE,
      h3_index VARCHAR,
      status VARCHAR,
      population_exposed INTEGER
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS dependencies (
      source_asset_id VARCHAR,
      target_asset_id VARCHAR,
      dependency_type VARCHAR,
      criticality VARCHAR,
      redundancy DOUBLE
    )
  `);
}

function ensureConn(): duckdb.AsyncDuckDBConnection {
  if (!conn) throw new Error('Analytics engine not initialized. Call initAnalyticsEngine() first.');
  return conn;
}

export async function ingestEvents(events: IntelligenceEvent[]): Promise<void> {
  const c = ensureConn();

  for (const e of events) {
    await c.query(`
      INSERT OR REPLACE INTO events VALUES (
        '${e.id}',
        '${e.type}',
        '${e.title.replace(/'/g, "''")}',
        ${e.location.latitude},
        ${e.location.longitude},
        '${e.h3Indices.res4}',
        '${e.h3Indices.res6}',
        '${e.h3Indices.res8}',
        '${e.timestamp.toISOString()}',
        '${e.reportedAt.toISOString()}',
        ${e.confidence.overall},
        '${e.confidence.level}',
        ${e.sources.length},
        '${e.status}',
        ${e.changeFromBaseline?.changeFromWeekBaseline ?? 0},
        ${e.changeFromBaseline?.accelerationRate ?? 0},
        ${e.changeFromBaseline?.novelty ?? 0},
        ${Math.round(e.location.latitude)}
      )
    `);
  }
}

export async function ingestAssets(assets: InfrastructureAsset[]): Promise<void> {
  const c = ensureConn();

  for (const a of assets) {
    await c.query(`
      INSERT OR REPLACE INTO assets VALUES (
        '${a.id}', '${a.type}', '${a.name.replace(/'/g, "''")}',
        ${a.location.latitude}, ${a.location.longitude},
        '${a.h3Index}', '${a.status}', ${a.populationExposed}
      )
    `);

    for (const dep of a.dependencies) {
      await c.query(`
        INSERT INTO dependencies VALUES (
          '${a.id}', '${dep.targetAssetId}',
          '${dep.dependencyType}', '${dep.criticality}', ${dep.redundancy}
        )
      `);
    }
  }
}

export async function getIncidentDensity(
  resolution: 4 | 6 | 8,
  timeframeHours: number,
): Promise<Array<{ h3Cell: string; count: number; rate: number }>> {
  const c = ensureConn();
  const col = `h3_res${resolution}`;
  const result = await c.query(`
    SELECT
      ${col} AS h3_cell,
      COUNT(*) AS count,
      COUNT(*) * 1.0 / ${timeframeHours} AS rate
    FROM events
    WHERE timestamp >= NOW() - INTERVAL '${timeframeHours} hours'
    GROUP BY ${col}
    ORDER BY count DESC
    LIMIT 100
  `);

  return result.toArray().map((row: Record<string, unknown>) => ({
    h3Cell: String(row.h3_cell),
    count: Number(row.count),
    rate: Number(row.rate),
  }));
}

export async function getChangeFromBaseline(
  resolution: 4 | 6 | 8,
  currentHours: number,
  baselineHours: number,
): Promise<Array<{ h3Cell: string; currentCount: number; baselineCount: number; changePercent: number }>> {
  const c = ensureConn();
  const col = `h3_res${resolution}`;
  const result = await c.query(`
    WITH current_period AS (
      SELECT ${col} AS cell, COUNT(*) AS cnt
      FROM events
      WHERE timestamp >= NOW() - INTERVAL '${currentHours} hours'
      GROUP BY ${col}
    ),
    baseline_period AS (
      SELECT ${col} AS cell, COUNT(*) * ${currentHours}.0 / ${baselineHours} AS cnt
      FROM events
      WHERE timestamp >= NOW() - INTERVAL '${baselineHours} hours'
        AND timestamp < NOW() - INTERVAL '${currentHours} hours'
      GROUP BY ${col}
    )
    SELECT
      COALESCE(c.cell, b.cell) AS h3_cell,
      COALESCE(c.cnt, 0) AS current_count,
      COALESCE(b.cnt, 0) AS baseline_count,
      CASE
        WHEN COALESCE(b.cnt, 0) = 0 THEN 100
        ELSE ((COALESCE(c.cnt, 0) - b.cnt) / b.cnt) * 100
      END AS change_percent
    FROM current_period c
    FULL OUTER JOIN baseline_period b ON c.cell = b.cell
    ORDER BY ABS(change_percent) DESC
  `);

  return result.toArray().map((row: Record<string, unknown>) => ({
    h3Cell: String(row.h3_cell),
    currentCount: Number(row.current_count),
    baselineCount: Number(row.baseline_count),
    changePercent: Number(row.change_percent),
  }));
}

export async function getInfrastructureExposure(
  h3Cell: string,
): Promise<Array<{ id: string; type: string; name: string; status: string; populationExposed: number }>> {
  const c = ensureConn();
  const result = await c.query(`
    SELECT id, type, name, status, population_exposed
    FROM assets
    WHERE h3_index = '${h3Cell}'
  `);

  return result.toArray().map((row: Record<string, unknown>) => ({
    id: String(row.id),
    type: String(row.type),
    name: String(row.name),
    status: String(row.status),
    populationExposed: Number(row.population_exposed),
  }));
}

export async function getConfidenceAdjustedRisk(
  resolution: 4 | 6 | 8,
  timeframeHours: number,
): Promise<Array<{ h3Cell: string; rawCount: number; adjustedRisk: number }>> {
  const c = ensureConn();
  const col = `h3_res${resolution}`;
  const result = await c.query(`
    SELECT
      ${col} AS h3_cell,
      COUNT(*) AS raw_count,
      SUM(
        CASE confidence_level
          WHEN 'verified' THEN 1.0
          WHEN 'strongly_corroborated' THEN 0.85
          WHEN 'partially_corroborated' THEN 0.6
          WHEN 'unconfirmed' THEN 0.3
          WHEN 'disputed' THEN 0.1
          ELSE 0.0
        END
      ) AS adjusted_risk
    FROM events
    WHERE timestamp >= NOW() - INTERVAL '${timeframeHours} hours'
    GROUP BY ${col}
    ORDER BY adjusted_risk DESC
  `);

  return result.toArray().map((row: Record<string, unknown>) => ({
    h3Cell: String(row.h3_cell),
    rawCount: Number(row.raw_count),
    adjustedRisk: Number(row.adjusted_risk),
  }));
}

export async function getTemporalPattern(
  h3Cell: string,
  days: number,
): Promise<Array<{ date: string; count: number }>> {
  const c = ensureConn();
  const result = await c.query(`
    SELECT
      CAST(timestamp AS DATE) AS date,
      COUNT(*) AS count
    FROM events
    WHERE h3_res6 = '${h3Cell}'
      AND timestamp >= NOW() - INTERVAL '${days} days'
    GROUP BY CAST(timestamp AS DATE)
    ORDER BY date
  `);

  return result.toArray().map((row: Record<string, unknown>) => ({
    date: String(row.date),
    count: Number(row.count),
  }));
}

export async function getNovelEvents(
  timeframeHours: number,
): Promise<Array<{ id: string; type: string; h3Cell: string }>> {
  const c = ensureConn();
  const result = await c.query(`
    SELECT e.id, e.type, e.h3_res6 AS h3_cell
    FROM events e
    WHERE e.timestamp >= NOW() - INTERVAL '${timeframeHours} hours'
      AND NOT EXISTS (
        SELECT 1 FROM events older
        WHERE older.type = e.type
          AND older.h3_res6 = e.h3_res6
          AND older.timestamp < NOW() - INTERVAL '${timeframeHours} hours'
      )
  `);

  return result.toArray().map((row: Record<string, unknown>) => ({
    id: String(row.id),
    type: String(row.type),
    h3Cell: String(row.h3_cell),
  }));
}

export async function getStoppedReporting(
  timeframeHours: number,
): Promise<Array<{ h3Cell: string; lastSeen: string; previousCount: number }>> {
  const c = ensureConn();
  const result = await c.query(`
    WITH recent AS (
      SELECT h3_res6 AS cell, COUNT(*) AS cnt
      FROM events
      WHERE timestamp >= NOW() - INTERVAL '${timeframeHours} hours'
      GROUP BY h3_res6
    ),
    historical AS (
      SELECT h3_res6 AS cell, COUNT(*) AS cnt, MAX(timestamp) AS last_seen
      FROM events
      WHERE timestamp < NOW() - INTERVAL '${timeframeHours} hours'
        AND timestamp >= NOW() - INTERVAL '${timeframeHours * 4} hours'
      GROUP BY h3_res6
      HAVING COUNT(*) >= 3
    )
    SELECT h.cell AS h3_cell, h.last_seen, h.cnt AS previous_count
    FROM historical h
    LEFT JOIN recent r ON h.cell = r.cell
    WHERE r.cell IS NULL
    ORDER BY h.cnt DESC
  `);

  return result.toArray().map((row: Record<string, unknown>) => ({
    h3Cell: String(row.h3_cell),
    lastSeen: String(row.last_seen),
    previousCount: Number(row.previous_count),
  }));
}

export async function destroyAnalyticsEngine(): Promise<void> {
  if (conn) { await conn.close(); conn = null; }
  if (db) { await db.terminate(); db = null; }
}
