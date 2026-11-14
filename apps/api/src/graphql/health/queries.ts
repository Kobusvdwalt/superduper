import { builder } from "../builder";
import { requireViewer } from "../context";
import {
  clientSyncs,
  listNutritionEntries,
  listQuantitySamples,
  listRawRecords,
  listSleepSessions,
  listSyncBatches,
  listWorkouts,
  metricCoverage,
  quantitySeries,
  recordTypeCoverage,
} from "./reads";
import {
  ClientSyncType,
  Health,
  HealthAggregationEnum,
  HealthBucketEnum,
  HealthMetricEnum,
  MetricCoverageType,
  NutritionEntryPage,
  QuantitySamplePage,
  QuantitySeriesType,
  RawRecordPage,
  RecordTypeCoverageType,
  SleepSessionPage,
  SyncBatchPage,
  WorkoutPage,
} from "./types";

builder.objectFields(Health.query, (t) => {
  const listArgs = () => ({
    from: t.arg({ type: "DateTime", required: false, description: "Inclusive start time." }),
    to: t.arg({ type: "DateTime", required: false, description: "Exclusive start time." }),
    dataOrigin: t.arg.string({ required: false, description: "Only rows written by this app." }),
    after: t.arg.string({ required: false }),
    limit: t.arg.int({ required: false, description: "Defaults to 100; clamped to 1000." }),
  });

  return {
    quantitySamples: t.field({
      type: QuantitySamplePage,
      description: "Samples of one metric in start-time order.",
      args: { metric: t.arg({ type: HealthMetricEnum, required: true }), ...listArgs() },
      resolve: (_root, args, ctx) => listQuantitySamples(ctx.db, requireViewer(ctx).userId, args),
    }),
    quantitySeries: t.field({
      type: QuantitySeriesType,
      description:
        "One metric aggregated into calendar buckets of `timeZone`. Samples count towards the bucket their start time falls in; empty buckets are omitted.",
      args: {
        metric: t.arg({ type: HealthMetricEnum, required: true }),
        from: t.arg({ type: "DateTime", required: true }),
        to: t.arg({ type: "DateTime", required: true }),
        bucket: t.arg({ type: HealthBucketEnum, required: true }),
        aggregation: t.arg({ type: HealthAggregationEnum, required: true }),
        dataOrigin: t.arg.string({ required: false }),
        timeZone: t.arg.string({
          required: false,
          defaultValue: "UTC",
          description: "IANA name, e.g. `Africa/Johannesburg`.",
        }),
      },
      resolve: async (_root, args, ctx) => ({
        metric: args.metric,
        buckets: await quantitySeries(ctx.db, requireViewer(ctx).userId, {
          ...args,
          timeZone: args.timeZone ?? "UTC",
        }),
      }),
    }),
    sleepSessions: t.field({
      type: SleepSessionPage,
      args: listArgs(),
      resolve: (_root, args, ctx) => listSleepSessions(ctx.db, requireViewer(ctx).userId, args),
    }),
    workouts: t.field({
      type: WorkoutPage,
      args: listArgs(),
      resolve: (_root, args, ctx) => listWorkouts(ctx.db, requireViewer(ctx).userId, args),
    }),
    nutritionEntries: t.field({
      type: NutritionEntryPage,
      args: listArgs(),
      resolve: (_root, args, ctx) => listNutritionEntries(ctx.db, requireViewer(ctx).userId, args),
    }),
    rawRecords: t.field({
      type: RawRecordPage,
      description: "Stored records with their payloads, in start-time order.",
      args: {
        recordType: t.arg.string({ required: false }),
        includeDeleted: t.arg.boolean({ required: false, defaultValue: false }),
        ...listArgs(),
      },
      resolve: (_root, args, ctx) => listRawRecords(ctx.db, requireViewer(ctx).userId, args),
    }),
    metrics: t.field({
      type: [MetricCoverageType],
      description: "Coverage per metric and data origin.",
      resolve: (_root, _args, ctx) => metricCoverage(ctx.db, requireViewer(ctx).userId),
    }),
    recordTypes: t.field({
      type: [RecordTypeCoverageType],
      description: "Coverage per raw record type and data origin, raw-only types included.",
      resolve: (_root, _args, ctx) => recordTypeCoverage(ctx.db, requireViewer(ctx).userId),
    }),
    syncBatches: t.field({
      type: SyncBatchPage,
      description: "Applied batches, newest first.",
      args: {
        clientId: t.arg({ type: "UUID", required: false }),
        after: t.arg.string({ required: false }),
        limit: t.arg.int({ required: false }),
      },
      resolve: (_root, args, ctx) => listSyncBatches(ctx.db, requireViewer(ctx).userId, args),
    }),
    clientSyncs: t.field({
      type: [ClientSyncType],
      description: "The last health sync of every client that has synced.",
      resolve: (_root, _args, ctx) => clientSyncs(ctx.db, requireViewer(ctx).userId),
    }),
  };
});
