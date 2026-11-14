import { sourcePriority } from "../../health/sources";
import { builder } from "../builder";
import { requireViewer } from "../context";
import { apiError } from "../errors";
import {
  clientSyncs,
  isTimeZone,
  getRawRecord,
  getSleepSession,
  getWorkout,
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
  HealthSourceModeEnum,
  MetricCoverageType,
  NutritionEntryPage,
  QuantitySamplePage,
  QuantitySeriesType,
  RawRecordPage,
  RawRecordType,
  RecordTypeCoverageType,
  SleepSessionPage,
  SleepSessionType,
  SourcePriorityType,
  SyncBatchPage,
  WorkoutPage,
  WorkoutType,
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
        dataOrigin: t.arg.string({
          required: false,
          description: "Only samples written by this app; the source mode does not apply.",
        }),
        sourceMode: t.arg({
          type: HealthSourceModeEnum,
          required: false,
          description:
            "For a cumulative metric without `dataOrigin`; defaults to PREFERRED. Ignored otherwise.",
        }),
        timeZone: t.arg.string({
          required: false,
          defaultValue: "UTC",
          description: "IANA name, e.g. `Africa/Johannesburg`. Also defines the local day.",
        }),
      },
      resolve: (_root, args, ctx) =>
        quantitySeries(ctx.db, requireViewer(ctx).userId, {
          ...args,
          timeZone: args.timeZone ?? "UTC",
        }),
    }),
    sourcePriority: t.field({
      type: SourcePriorityType,
      description: "The data origin order PREFERRED series of this metric use, and why.",
      args: {
        metric: t.arg({ type: HealthMetricEnum, required: true }),
        timeZone: t.arg.string({
          required: false,
          defaultValue: "UTC",
          description: "Defines the local days counted for the default ranking.",
        }),
      },
      resolve: (_root, args, ctx) => {
        const timeZone = args.timeZone ?? "UTC";
        if (!isTimeZone(timeZone)) throw apiError("BAD_USER_INPUT", "Unknown timeZone.");
        return sourcePriority(ctx.db, requireViewer(ctx).userId, args.metric, timeZone);
      },
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
    rawRecord: t.field({
      type: RawRecordType,
      nullable: true,
      description: "One stored record, deleted ones included; null if it does not exist.",
      args: { id: t.arg({ type: "UUID", required: true }) },
      resolve: (_root, args, ctx) => getRawRecord(ctx.db, requireViewer(ctx).userId, args.id),
    }),
    sleepSession: t.field({
      type: SleepSessionType,
      nullable: true,
      args: { id: t.arg({ type: "UUID", required: true }) },
      resolve: (_root, args, ctx) => getSleepSession(ctx.db, requireViewer(ctx).userId, args.id),
    }),
    workout: t.field({
      type: WorkoutType,
      nullable: true,
      args: { id: t.arg({ type: "UUID", required: true }) },
      resolve: (_root, args, ctx) => getWorkout(ctx.db, requireViewer(ctx).userId, args.id),
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
