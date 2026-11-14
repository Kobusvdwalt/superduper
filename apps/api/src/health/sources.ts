import { and, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../db";
import { healthSourcePriorities, type HealthMetric } from "../db/schema";
import { apiError } from "../graphql/errors";

/**
 * Metrics whose samples are amounts over an interval and add up. Several apps often record the
 * same activity, so summing every origin double counts; see `quantitySeries`.
 */
const CUMULATIVE_METRICS: ReadonlySet<HealthMetric> = new Set<HealthMetric>([
  "STEPS",
  "DISTANCE",
  "FLOORS_CLIMBED",
  "ELEVATION_GAINED",
  "WHEELCHAIR_PUSHES",
  "ACTIVE_ENERGY_BURNED",
  "TOTAL_ENERGY_BURNED",
  "HYDRATION",
]);

export function isCumulative(metric: HealthMetric): boolean {
  return CUMULATIVE_METRICS.has(metric);
}

export type SourceMode = "PREFERRED" | "ALL";

const MAX_ORIGINS = 100;
const MAX_ORIGIN_LENGTH = 255;

/** Samples without a data origin rank as the origin `''`, exposed as null. */
const originKey = sql.raw(`coalesce(s.data_origin, '')`);

/**
 * Every origin with samples of the metric, ranked: the user's saved order first, then most
 * local days covered, then most samples, then origin name. Columns: origin, days, samples,
 * first_time, last_time, saved_rank, rank.
 */
function rankedOrigins(userId: string, metric: HealthMetric, timeZone: string): SQL {
  return sql`
    SELECT c.*, row_number() OVER (
      ORDER BY c.saved_rank NULLS LAST, c.days DESC, c.samples DESC, c.origin
    )::int AS rank
    FROM (
      SELECT ${originKey} AS origin,
        count(DISTINCT date_trunc('day', s.start_time, ${timeZone}))::int AS days,
        count(*)::int AS samples,
        min(s.start_time) AS first_time,
        max(s.start_time) AS last_time,
        array_position(p.data_origins, ${originKey}) AS saved_rank
      FROM health_quantity_samples s
      LEFT JOIN health_source_priorities p ON p.user_id = s.user_id AND p.metric = s.metric
      WHERE s.user_id = ${userId} AND s.metric = ${metric}
      GROUP BY 1, p.data_origins
    ) c`;
}

type RankedRow = {
  origin: string;
  days: number;
  samples: number;
  first_time: Date | string;
  last_time: Date | string;
  saved_rank: number | null;
  rank: number;
};

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));
export const originOut = (origin: string) => (origin === "" ? null : origin);

export async function sourcePriority(
  db: Database,
  userId: string,
  metric: HealthMetric,
  timeZone: string,
) {
  const [saved] = await db
    .select({ dataOrigins: healthSourcePriorities.dataOrigins })
    .from(healthSourcePriorities)
    .where(
      and(eq(healthSourcePriorities.userId, userId), eq(healthSourcePriorities.metric, metric)),
    );
  const rows = (await db.execute(
    sql`${rankedOrigins(userId, metric, timeZone)} ORDER BY rank`,
  )) as unknown as RankedRow[];
  return {
    metric,
    cumulative: isCumulative(metric),
    savedOrder: saved?.dataOrigins ?? [],
    origins: rows.map((row) => ({
      dataOrigin: originOut(row.origin),
      rank: row.rank,
      saved: row.saved_rank !== null,
      days: row.days,
      samples: row.samples,
      firstTime: toDate(row.first_time),
      lastTime: toDate(row.last_time),
    })),
  };
}

/** Saves the order; an empty list clears it so the default ranking applies again. */
export async function setSourcePriority(
  db: Database,
  userId: string,
  metric: HealthMetric,
  dataOrigins: string[],
) {
  if (!isCumulative(metric)) {
    throw apiError("BAD_USER_INPUT", "Source priority applies only to cumulative metrics.");
  }
  if (dataOrigins.length > MAX_ORIGINS) {
    throw apiError("BAD_USER_INPUT", `At most ${MAX_ORIGINS} data origins.`);
  }
  if (dataOrigins.some((origin) => origin.length === 0 || origin.length > MAX_ORIGIN_LENGTH)) {
    throw apiError("BAD_USER_INPUT", `Data origins must be 1 to ${MAX_ORIGIN_LENGTH} characters.`);
  }
  if (new Set(dataOrigins).size !== dataOrigins.length) {
    throw apiError("BAD_USER_INPUT", "Data origins must not repeat.");
  }

  const where = and(
    eq(healthSourcePriorities.userId, userId),
    eq(healthSourcePriorities.metric, metric),
  );
  if (dataOrigins.length === 0) {
    await db.delete(healthSourcePriorities).where(where);
    return;
  }
  await db
    .insert(healthSourcePriorities)
    .values({ userId, metric, dataOrigins })
    .onConflictDoUpdate({
      target: [healthSourcePriorities.userId, healthSourcePriorities.metric],
      set: { dataOrigins, updatedAt: new Date() },
    });
}

/**
 * The samples a series is built from, as a CTE `used` (start_time, value, origin, day). In
 * PREFERRED mode each local day keeps only the highest-ranked origin with samples that day;
 * overlapping intervals within a day are not split between origins.
 */
export function seriesSamples(args: {
  userId: string;
  metric: HealthMetric;
  from: Date;
  to: Date;
  dataOrigin: string | null;
  timeZone: string;
  mode: SourceMode;
}): SQL {
  const used =
    args.mode === "PREFERRED"
      ? sql`picked AS (
          SELECT DISTINCT ON (s.day) s.day, s.origin
          FROM s JOIN (${rankedOrigins(args.userId, args.metric, args.timeZone)}) r
            ON r.origin = s.origin
          ORDER BY s.day, r.rank
        ),
        used AS (SELECT s.* FROM s JOIN picked p ON p.day = s.day AND p.origin = s.origin)`
      : sql`used AS (SELECT * FROM s)`;
  return sql`
    WITH s AS (
      SELECT s.start_time, s.value, ${originKey} AS origin,
        date_trunc('day', s.start_time, ${args.timeZone}) AS day
      FROM health_quantity_samples s
      WHERE s.user_id = ${args.userId} AND s.metric = ${args.metric}
        AND s.start_time >= ${args.from.toISOString()}::timestamptz
        AND s.start_time < ${args.to.toISOString()}::timestamptz
        ${args.dataOrigin === null ? sql`` : sql`AND s.data_origin = ${args.dataOrigin}`}
    ),
    ${used}`;
}
