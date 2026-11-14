import {
  HEALTH_METRICS,
  HEALTH_SLEEP_STAGES,
  type clients,
  type healthNutritionEntries,
  type healthQuantitySamples,
  type healthRawRecords,
  type healthRawRecordVersions,
  type healthSleepSessions,
  type healthSleepStages,
  type healthWorkoutLaps,
  type healthWorkoutRoutePoints,
  type healthWorkouts,
  type healthWorkoutSegments,
  type HealthMetric,
  type syncBatches,
} from "../../db/schema";
import { HEALTH_METRIC_UNITS } from "../../health/projection/project";
import type { HealthSyncResult } from "../../health/types";
import { builder } from "../builder";
import { ClientType } from "../identity/types";
import { namespace } from "../namespaces";
import { pageType } from "../pagination";
import {
  AGGREGATIONS,
  BUCKETS,
  listRawRecordVersions,
  listSleepStages,
  listWorkoutLaps,
  listWorkoutRoute,
  listWorkoutSegments,
} from "./reads";

export const Health = namespace("Health", "health");

export const HealthOriginEnum = builder.enumType("HealthOrigin", {
  values: ["HEALTH_CONNECT"] as const,
});

export const HealthMetricEnum = builder.enumType("HealthMetric", {
  values: HEALTH_METRICS,
  description:
    "A numeric health measurement. Each has one canonical unit; see `HealthMetricCoverage.unit`.",
});

const HealthSleepStageEnum = builder.enumType("HealthSleepStage", {
  values: HEALTH_SLEEP_STAGES,
});

export const HealthBucketEnum = builder.enumType("HealthBucket", { values: BUCKETS });

export const HealthAggregationEnum = builder.enumType("HealthAggregation", {
  values: AGGREGATIONS,
});

export const HealthSyncResultType = builder
  .objectRef<HealthSyncResult>("HealthSyncResult")
  .implement({
    fields: (t) => ({
      batchId: t.expose("batchId", { type: "UUID" }),
      replayed: t.exposeBoolean("replayed", {
        description: "True when this batchId was already applied; nothing changed.",
      }),
      acceptedRecords: t.exposeInt("acceptedRecords"),
      acceptedDeletions: t.exposeInt("acceptedDeletions"),
    }),
  });

const unitField = {
  description: "Canonical unit of every value of this metric.",
} as const;

const QuantitySampleType = builder
  .objectRef<typeof healthQuantitySamples.$inferSelect>("HealthQuantitySample")
  .implement({
    fields: (t) => ({
      id: t.expose("id", { type: "UUID" }),
      metric: t.expose("metric", { type: HealthMetricEnum }),
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", {
        type: "DateTime",
        nullable: true,
        description: "Null for an instantaneous measurement.",
      }),
      value: t.exposeFloat("value"),
      unit: t.exposeString("unit", unitField),
      dataOrigin: t.exposeString("dataOrigin", { nullable: true }),
      rawRecordId: t.expose("rawRecordId", { type: "UUID" }),
    }),
  });

export const QuantitySamplePage = pageType("HealthQuantitySamplePage", QuantitySampleType);

const QuantityBucketType = builder
  .objectRef<{ bucketStart: Date; value: number; count: number }>("HealthQuantityBucket")
  .implement({
    fields: (t) => ({
      bucketStart: t.expose("bucketStart", { type: "DateTime" }),
      value: t.exposeFloat("value"),
      count: t.exposeInt("count", { description: "Samples in the bucket." }),
    }),
  });

export const QuantitySeriesType = builder
  .objectRef<{
    metric: HealthMetric;
    buckets: { bucketStart: Date; value: number; count: number }[];
  }>("HealthQuantitySeries")
  .implement({
    fields: (t) => ({
      metric: t.expose("metric", { type: HealthMetricEnum }),
      unit: t.string({ ...unitField, resolve: (series) => HEALTH_METRIC_UNITS[series.metric] }),
      buckets: t.field({ type: [QuantityBucketType], resolve: (series) => series.buckets }),
    }),
  });

const SleepStageType = builder
  .objectRef<typeof healthSleepStages.$inferSelect>("HealthSleepStageInterval")
  .implement({
    fields: (t) => ({
      stage: t.expose("stage", { type: HealthSleepStageEnum }),
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", { type: "DateTime" }),
    }),
  });

export const SleepSessionType = builder
  .objectRef<typeof healthSleepSessions.$inferSelect>("HealthSleepSession")
  .implement({
    fields: (t) => ({
      id: t.expose("id", { type: "UUID" }),
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", { type: "DateTime" }),
      startZoneOffsetSeconds: t.exposeInt("startZoneOffsetSeconds", { nullable: true }),
      endZoneOffsetSeconds: t.exposeInt("endZoneOffsetSeconds", { nullable: true }),
      title: t.exposeString("title", { nullable: true }),
      notes: t.exposeString("notes", { nullable: true }),
      dataOrigin: t.exposeString("dataOrigin", { nullable: true }),
      rawRecordId: t.expose("rawRecordId", { type: "UUID" }),
      stages: t.field({
        type: [SleepStageType],
        resolve: (session, _args, ctx) => listSleepStages(ctx.db, session.id),
      }),
    }),
  });

export const SleepSessionPage = pageType("HealthSleepSessionPage", SleepSessionType);

const WorkoutSegmentType = builder
  .objectRef<typeof healthWorkoutSegments.$inferSelect>("HealthWorkoutSegment")
  .implement({
    fields: (t) => ({
      segmentType: t.exposeString("segmentType"),
      repetitions: t.exposeInt("repetitions", { nullable: true }),
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", { type: "DateTime" }),
    }),
  });

const WorkoutLapType = builder
  .objectRef<typeof healthWorkoutLaps.$inferSelect>("HealthWorkoutLap")
  .implement({
    fields: (t) => ({
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", { type: "DateTime" }),
      lengthMeters: t.exposeFloat("lengthMeters", { nullable: true }),
    }),
  });

const RoutePointType = builder
  .objectRef<typeof healthWorkoutRoutePoints.$inferSelect>("HealthRoutePoint")
  .implement({
    fields: (t) => ({
      time: t.expose("time", { type: "DateTime" }),
      latitude: t.exposeFloat("latitude"),
      longitude: t.exposeFloat("longitude"),
      altitudeMeters: t.exposeFloat("altitudeMeters", { nullable: true }),
      horizontalAccuracyMeters: t.exposeFloat("horizontalAccuracyMeters", { nullable: true }),
      verticalAccuracyMeters: t.exposeFloat("verticalAccuracyMeters", { nullable: true }),
    }),
  });

const RouteStatusEnum = builder.enumType("HealthRouteStatus", {
  values: ["DATA", "NO_DATA", "CONSENT_REQUIRED"] as const,
});

export const WorkoutType = builder
  .objectRef<typeof healthWorkouts.$inferSelect>("HealthWorkout")
  .implement({
    fields: (t) => ({
      id: t.expose("id", { type: "UUID" }),
      activityType: t.exposeString("activityType", {
        description: "The origin's activity constant name, e.g. `RUNNING`; `UNKNOWN` if unnamed.",
      }),
      title: t.exposeString("title", { nullable: true }),
      notes: t.exposeString("notes", { nullable: true }),
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", { type: "DateTime" }),
      startZoneOffsetSeconds: t.exposeInt("startZoneOffsetSeconds", { nullable: true }),
      endZoneOffsetSeconds: t.exposeInt("endZoneOffsetSeconds", { nullable: true }),
      routeStatus: t.expose("routeStatus", { type: RouteStatusEnum, nullable: true }),
      dataOrigin: t.exposeString("dataOrigin", { nullable: true }),
      rawRecordId: t.expose("rawRecordId", { type: "UUID" }),
      segments: t.field({
        type: [WorkoutSegmentType],
        resolve: (workout, _args, ctx) => listWorkoutSegments(ctx.db, workout.id),
      }),
      laps: t.field({
        type: [WorkoutLapType],
        resolve: (workout, _args, ctx) => listWorkoutLaps(ctx.db, workout.id),
      }),
      route: t.field({
        type: [RoutePointType],
        resolve: (workout, _args, ctx) => listWorkoutRoute(ctx.db, workout.id),
      }),
    }),
  });

export const WorkoutPage = pageType("HealthWorkoutPage", WorkoutType);

const NutrientAmountType = builder
  .objectRef<{ nutrient: string; value: number; unit: string }>("HealthNutrientAmount")
  .implement({
    fields: (t) => ({
      nutrient: t.exposeString("nutrient", { description: "For example `vitaminC`." }),
      value: t.exposeFloat("value"),
      unit: t.exposeString("unit", { description: "`grams`, or `kilocalories` for energy." }),
    }),
  });

const NutritionEntryType = builder
  .objectRef<typeof healthNutritionEntries.$inferSelect>("HealthNutritionEntry")
  .implement({
    fields: (t) => ({
      id: t.expose("id", { type: "UUID" }),
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", { type: "DateTime" }),
      mealType: t.exposeString("mealType", { nullable: true, description: "e.g. `BREAKFAST`." }),
      name: t.exposeString("name", { nullable: true }),
      energyKilocalories: t.exposeFloat("energyKilocalories", { nullable: true }),
      proteinGrams: t.exposeFloat("proteinGrams", { nullable: true }),
      totalCarbohydrateGrams: t.exposeFloat("totalCarbohydrateGrams", { nullable: true }),
      totalFatGrams: t.exposeFloat("totalFatGrams", { nullable: true }),
      dietaryFiberGrams: t.exposeFloat("dietaryFiberGrams", { nullable: true }),
      sugarGrams: t.exposeFloat("sugarGrams", { nullable: true }),
      nutrients: t.field({
        type: [NutrientAmountType],
        description: "Every other nutrient the entry records.",
        resolve: (entry) =>
          Object.entries(entry.nutrients).map(([nutrient, value]) => ({
            nutrient,
            value,
            unit: nutrient === "energyFromFat" ? "kilocalories" : "grams",
          })),
      }),
      dataOrigin: t.exposeString("dataOrigin", { nullable: true }),
      rawRecordId: t.expose("rawRecordId", { type: "UUID" }),
    }),
  });

export const NutritionEntryPage = pageType("HealthNutritionEntryPage", NutritionEntryType);

const RecordOperationEnum = builder.enumType("HealthRecordOperation", {
  values: ["UPSERT", "DELETE"] as const,
});

const RawRecordVersionType = builder
  .objectRef<typeof healthRawRecordVersions.$inferSelect>("HealthRawRecordVersion")
  .implement({
    description: "One distinct version of a record or deletion as received.",
    fields: (t) => ({
      id: t.expose("id", { type: "UUID" }),
      operation: t.expose("operation", { type: RecordOperationEnum }),
      applied: t.exposeBoolean("applied", {
        description: "Whether this version became the current state when it arrived.",
      }),
      modifiedAt: t.expose("modifiedAt", { type: "DateTime", nullable: true }),
      deletedAt: t.expose("deletedAt", { type: "DateTime", nullable: true }),
      receivedAt: t.expose("receivedAt", { type: "DateTime" }),
      schemaVersion: t.exposeInt("schemaVersion"),
      syncBatchId: t.expose("syncBatchId", { type: "UUID" }),
      payload: t.expose("payload", { type: "JSON", nullable: true }),
    }),
  });

export const RawRecordType = builder
  .objectRef<typeof healthRawRecords.$inferSelect>("HealthRawRecord")
  .implement({
    description: "A record exactly as the client pushed it; the source of every typed table.",
    fields: (t) => ({
      id: t.expose("id", { type: "UUID" }),
      clientId: t.expose("clientId", { type: "UUID" }),
      origin: t.expose("origin", { type: HealthOriginEnum }),
      recordType: t.exposeString("recordType"),
      sourceRecordId: t.exposeString("sourceRecordId"),
      dataOrigin: t.exposeString("dataOrigin", { nullable: true }),
      startTime: t.expose("startTime", { type: "DateTime" }),
      endTime: t.expose("endTime", { type: "DateTime", nullable: true }),
      startZoneOffsetSeconds: t.exposeInt("startZoneOffsetSeconds", { nullable: true }),
      endZoneOffsetSeconds: t.exposeInt("endZoneOffsetSeconds", { nullable: true }),
      modifiedAt: t.expose("modifiedAt", { type: "DateTime" }),
      schemaVersion: t.exposeInt("schemaVersion"),
      payload: t.expose("payload", { type: "JSON" }),
      deletedAt: t.expose("deletedAt", { type: "DateTime", nullable: true }),
      receivedAt: t.expose("receivedAt", { type: "DateTime" }),
      projectionError: t.exposeString("projectionError", {
        nullable: true,
        description: "Why the typed projection failed; the record itself is still stored.",
      }),
      versions: t.field({
        type: [RawRecordVersionType],
        description: "Every version received for this record's source identity, oldest first.",
        resolve: (record, _args, ctx) => listRawRecordVersions(ctx.db, record),
      }),
    }),
  });

export const RawRecordPage = pageType("HealthRawRecordPage", RawRecordType);

export const MetricCoverageType = builder
  .objectRef<{
    metric: HealthMetric;
    dataOrigin: string | null;
    count: number;
    firstTime: Date | null;
    lastTime: Date | null;
  }>("HealthMetricCoverage")
  .implement({
    fields: (t) => ({
      metric: t.expose("metric", { type: HealthMetricEnum }),
      unit: t.string({ ...unitField, resolve: (row) => HEALTH_METRIC_UNITS[row.metric] }),
      dataOrigin: t.exposeString("dataOrigin", { nullable: true }),
      count: t.exposeInt("count"),
      firstTime: t.expose("firstTime", { type: "DateTime", nullable: true }),
      lastTime: t.expose("lastTime", { type: "DateTime", nullable: true }),
    }),
  });

export const RecordTypeCoverageType = builder
  .objectRef<{
    recordType: string;
    dataOrigin: string | null;
    count: number;
    projectionErrors: number;
    firstTime: Date | null;
    lastTime: Date | null;
  }>("HealthRecordTypeCoverage")
  .implement({
    fields: (t) => ({
      recordType: t.exposeString("recordType"),
      dataOrigin: t.exposeString("dataOrigin", { nullable: true }),
      count: t.exposeInt("count"),
      projectionErrors: t.exposeInt("projectionErrors"),
      firstTime: t.expose("firstTime", { type: "DateTime", nullable: true }),
      lastTime: t.expose("lastTime", { type: "DateTime", nullable: true }),
    }),
  });

const SyncBatchType = builder
  .objectRef<typeof syncBatches.$inferSelect>("HealthSyncBatch")
  .implement({
    fields: (t) => ({
      id: t.expose("id", { type: "UUID" }),
      batchId: t.expose("batchId", { type: "UUID", description: "The client's idempotency key." }),
      clientId: t.expose("clientId", { type: "UUID" }),
      schemaVersion: t.exposeInt("schemaVersion"),
      recordCount: t.exposeInt("recordCount"),
      deletionCount: t.exposeInt("deletionCount"),
      receivedAt: t.expose("receivedAt", { type: "DateTime" }),
    }),
  });

export const SyncBatchPage = pageType("HealthSyncBatchPage", SyncBatchType);

export const ClientSyncType = builder
  .objectRef<{ client: typeof clients.$inferSelect; lastSyncedAt: Date; batches: number }>(
    "HealthClientSync",
  )
  .implement({
    fields: (t) => ({
      client: t.field({ type: ClientType, resolve: (row) => row.client }),
      lastSyncedAt: t.expose("lastSyncedAt", { type: "DateTime" }),
      batches: t.exposeInt("batches"),
    }),
  });
