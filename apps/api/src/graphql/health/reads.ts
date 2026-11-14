import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  max,
  min,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import type { Database } from "../../db";
import {
  clients,
  healthNutritionEntries,
  healthQuantitySamples,
  healthRawRecords,
  healthRawRecordVersions,
  healthSleepSessions,
  healthSleepStages,
  healthWorkoutLaps,
  healthWorkoutRoutePoints,
  healthWorkouts,
  healthWorkoutSegments,
  syncBatches,
  type HealthMetric,
} from "../../db/schema";
import { apiError } from "../errors";
import { clampLimit, decodeCursor, toPage, type Cursor } from "../pagination";

type TimeRange = { from?: Date | null; to?: Date | null };
export type ListArgs = TimeRange & {
  dataOrigin?: string | null;
  after?: string | null;
  limit?: number | null;
};

function within(column: PgColumn, range: TimeRange): (SQL | undefined)[] {
  if (range.from && range.to && range.to < range.from) {
    throw apiError("BAD_USER_INPUT", "to precedes from.");
  }
  return [
    range.from ? gte(column, range.from) : undefined,
    range.to ? lt(column, range.to) : undefined,
  ];
}

function afterCursor(
  time: PgColumn,
  id: PgColumn,
  cursor: Cursor | null,
  direction: "asc" | "desc",
) {
  if (!cursor) return undefined;
  const position = sql`(${cursor.time.toISOString()}::timestamptz, ${cursor.id}::uuid)`;
  return direction === "asc"
    ? sql`(${time}, ${id}) > ${position}`
    : sql`(${time}, ${id}) < ${position}`;
}

const byStart = (row: { startTime: Date; id: string }) => ({ time: row.startTime, id: row.id });

export async function listQuantitySamples(
  db: Database,
  userId: string,
  args: ListArgs & { metric: HealthMetric },
) {
  const t = healthQuantitySamples;
  const limit = clampLimit(args.limit);
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        eq(t.metric, args.metric),
        args.dataOrigin ? eq(t.dataOrigin, args.dataOrigin) : undefined,
        ...within(t.startTime, args),
        afterCursor(t.startTime, t.id, decodeCursor(args.after), "asc"),
      ),
    )
    .orderBy(asc(t.startTime), asc(t.id))
    .limit(limit + 1);
  return toPage(rows, limit, byStart);
}

export const BUCKETS = ["HOUR", "DAY", "WEEK", "MONTH"] as const;
export const AGGREGATIONS = ["SUM", "AVG", "MIN", "MAX", "COUNT"] as const;

const BUCKET_HOURS: Record<(typeof BUCKETS)[number], number> = {
  HOUR: 1,
  DAY: 24,
  WEEK: 24 * 7,
  MONTH: 24 * 28,
};
const MAX_BUCKETS = 10_000;

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Samples are bucketed by their start time; an interval that crosses a bucket boundary counts
 * entirely towards the bucket it starts in. Buckets without samples are omitted.
 */
export async function quantitySeries(
  db: Database,
  userId: string,
  args: {
    metric: HealthMetric;
    from: Date;
    to: Date;
    bucket: (typeof BUCKETS)[number];
    aggregation: (typeof AGGREGATIONS)[number];
    dataOrigin?: string | null;
    timeZone: string;
  },
) {
  if (args.to <= args.from) throw apiError("BAD_USER_INPUT", "to must be after from.");
  if (!isTimeZone(args.timeZone)) throw apiError("BAD_USER_INPUT", "Unknown timeZone.");
  const hours = (args.to.getTime() - args.from.getTime()) / 3_600_000;
  if (hours / BUCKET_HOURS[args.bucket] > MAX_BUCKETS) {
    throw apiError("BAD_USER_INPUT", `The range spans more than ${MAX_BUCKETS} buckets.`);
  }

  const t = healthQuantitySamples;
  const value = {
    SUM: sql<number>`sum(${t.value})`,
    AVG: sql<number>`avg(${t.value})`,
    MIN: sql<number>`min(${t.value})`,
    MAX: sql<number>`max(${t.value})`,
    COUNT: sql<number>`count(*)`,
  }[args.aggregation];
  const unit = args.bucket.toLowerCase();

  return db
    .select({
      bucketStart: sql<Date>`date_trunc(${unit}, ${t.startTime}, ${args.timeZone})`.mapWith(
        t.startTime,
      ),
      value: value.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        eq(t.metric, args.metric),
        args.dataOrigin ? eq(t.dataOrigin, args.dataOrigin) : undefined,
        ...within(t.startTime, args),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

export async function listSleepSessions(db: Database, userId: string, args: ListArgs) {
  const t = healthSleepSessions;
  const limit = clampLimit(args.limit);
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        args.dataOrigin ? eq(t.dataOrigin, args.dataOrigin) : undefined,
        ...within(t.startTime, args),
        afterCursor(t.startTime, t.id, decodeCursor(args.after), "asc"),
      ),
    )
    .orderBy(asc(t.startTime), asc(t.id))
    .limit(limit + 1);
  return toPage(rows, limit, byStart);
}

export function listSleepStages(db: Database, sessionId: string) {
  return db
    .select()
    .from(healthSleepStages)
    .where(eq(healthSleepStages.sessionId, sessionId))
    .orderBy(asc(healthSleepStages.startTime));
}

export async function listWorkouts(db: Database, userId: string, args: ListArgs) {
  const t = healthWorkouts;
  const limit = clampLimit(args.limit);
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        args.dataOrigin ? eq(t.dataOrigin, args.dataOrigin) : undefined,
        ...within(t.startTime, args),
        afterCursor(t.startTime, t.id, decodeCursor(args.after), "asc"),
      ),
    )
    .orderBy(asc(t.startTime), asc(t.id))
    .limit(limit + 1);
  return toPage(rows, limit, byStart);
}

export function listWorkoutSegments(db: Database, workoutId: string) {
  return db
    .select()
    .from(healthWorkoutSegments)
    .where(eq(healthWorkoutSegments.workoutId, workoutId))
    .orderBy(asc(healthWorkoutSegments.startTime));
}

export function listWorkoutLaps(db: Database, workoutId: string) {
  return db
    .select()
    .from(healthWorkoutLaps)
    .where(eq(healthWorkoutLaps.workoutId, workoutId))
    .orderBy(asc(healthWorkoutLaps.startTime));
}

export function listWorkoutRoute(db: Database, workoutId: string) {
  return db
    .select()
    .from(healthWorkoutRoutePoints)
    .where(eq(healthWorkoutRoutePoints.workoutId, workoutId))
    .orderBy(asc(healthWorkoutRoutePoints.time));
}

export async function listNutritionEntries(db: Database, userId: string, args: ListArgs) {
  const t = healthNutritionEntries;
  const limit = clampLimit(args.limit);
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        args.dataOrigin ? eq(t.dataOrigin, args.dataOrigin) : undefined,
        ...within(t.startTime, args),
        afterCursor(t.startTime, t.id, decodeCursor(args.after), "asc"),
      ),
    )
    .orderBy(asc(t.startTime), asc(t.id))
    .limit(limit + 1);
  return toPage(rows, limit, byStart);
}

export async function listRawRecords(
  db: Database,
  userId: string,
  args: ListArgs & { recordType?: string | null; includeDeleted?: boolean | null },
) {
  const t = healthRawRecords;
  const limit = clampLimit(args.limit);
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        args.recordType ? eq(t.recordType, args.recordType) : undefined,
        args.dataOrigin ? eq(t.dataOrigin, args.dataOrigin) : undefined,
        args.includeDeleted ? undefined : isNull(t.deletedAt),
        ...within(t.startTime, args),
        afterCursor(t.startTime, t.id, decodeCursor(args.after), "asc"),
      ),
    )
    .orderBy(asc(t.startTime), asc(t.id))
    .limit(limit + 1);
  return toPage(rows, limit, byStart);
}

export async function getRawRecord(db: Database, userId: string, id: string) {
  const t = healthRawRecords;
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.userId, userId), eq(t.id, id)));
  return row ?? null;
}

/** Every version received for the record's source identity from any client, oldest first. */
export function listRawRecordVersions(db: Database, record: typeof healthRawRecords.$inferSelect) {
  const t = healthRawRecordVersions;
  return db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, record.userId),
        eq(t.origin, record.origin),
        eq(t.recordType, record.recordType),
        eq(t.sourceRecordId, record.sourceRecordId),
      ),
    )
    .orderBy(asc(t.receivedAt), asc(t.id));
}

export async function getSleepSession(db: Database, userId: string, id: string) {
  const t = healthSleepSessions;
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.userId, userId), eq(t.id, id)));
  return row ?? null;
}

export async function getWorkout(db: Database, userId: string, id: string) {
  const t = healthWorkouts;
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.userId, userId), eq(t.id, id)));
  return row ?? null;
}

export function metricCoverage(db: Database, userId: string) {
  const t = healthQuantitySamples;
  return db
    .select({
      metric: t.metric,
      dataOrigin: t.dataOrigin,
      count: count().mapWith(Number),
      firstTime: min(t.startTime),
      lastTime: max(t.startTime),
    })
    .from(t)
    .where(eq(t.userId, userId))
    .groupBy(t.metric, t.dataOrigin)
    .orderBy(asc(t.metric), asc(t.dataOrigin));
}

export function recordTypeCoverage(db: Database, userId: string) {
  const t = healthRawRecords;
  return db
    .select({
      recordType: t.recordType,
      dataOrigin: t.dataOrigin,
      count: count().mapWith(Number),
      projectionErrors: sql<number>`count(${t.projectionError})`.mapWith(Number),
      firstTime: min(t.startTime),
      lastTime: max(t.startTime),
    })
    .from(t)
    .where(and(eq(t.userId, userId), isNull(t.deletedAt)))
    .groupBy(t.recordType, t.dataOrigin)
    .orderBy(asc(t.recordType), asc(t.dataOrigin));
}

export async function listSyncBatches(
  db: Database,
  userId: string,
  args: { clientId?: string | null; after?: string | null; limit?: number | null },
) {
  const t = syncBatches;
  const limit = clampLimit(args.limit);
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        eq(t.domain, "health"),
        args.clientId ? eq(t.clientId, args.clientId) : undefined,
        afterCursor(t.receivedAt, t.id, decodeCursor(args.after), "desc"),
      ),
    )
    .orderBy(desc(t.receivedAt), desc(t.id))
    .limit(limit + 1);
  return toPage(rows, limit, (row) => ({ time: row.receivedAt, id: row.id }));
}

export async function clientSyncs(db: Database, userId: string) {
  const stats = await db
    .select({
      clientId: syncBatches.clientId,
      lastSyncedAt: max(syncBatches.receivedAt),
      batches: count().mapWith(Number),
    })
    .from(syncBatches)
    .where(and(eq(syncBatches.userId, userId), eq(syncBatches.domain, "health")))
    .groupBy(syncBatches.clientId);
  if (stats.length === 0) return [];

  const owners = await db
    .select()
    .from(clients)
    .where(
      inArray(
        clients.id,
        stats.flatMap((row) => (row.clientId ? [row.clientId] : [])),
      ),
    );
  const byId = new Map(owners.map((client) => [client.id, client]));

  return stats.flatMap((row) => {
    const client = row.clientId ? byId.get(row.clientId) : undefined;
    return client && row.lastSyncedAt
      ? [{ client, lastSyncedAt: row.lastSyncedAt, batches: row.batches }]
      : [];
  });
}
