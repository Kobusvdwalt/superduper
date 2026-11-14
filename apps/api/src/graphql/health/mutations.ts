import { ingestHealthBatch } from "../../health/ingest";
import { setSourcePriority, sourcePriority } from "../../health/sources";
import { builder } from "../builder";
import { requireClient, requireSession } from "../context";
import { apiError } from "../errors";
import { HealthSyncInput } from "./inputs";
import { isTimeZone } from "./reads";
import { Health, HealthMetricEnum, HealthSyncResultType, SourcePriorityType } from "./types";

builder.objectFields(Health.mutation, (t) => ({
  sync: t.field({
    type: HealthSyncResultType,
    description: "Applies one batch of records and deletions. Clients only.",
    args: { input: t.arg({ type: HealthSyncInput, required: true }) },
    resolve: (_root, { input }, ctx) => {
      const { client } = requireClient(ctx);
      return ingestHealthBatch(ctx.db, client, input);
    },
  }),
  setSourcePriority: t.field({
    type: SourcePriorityType,
    description:
      "Saves the data origin order of a cumulative metric, highest priority first. An empty list restores the default ranking. Requires a session.",
    args: {
      metric: t.arg({ type: HealthMetricEnum, required: true }),
      dataOrigins: t.arg.stringList({ required: true }),
      timeZone: t.arg.string({ required: false, defaultValue: "UTC" }),
    },
    resolve: async (_root, args, ctx) => {
      const { userId } = requireSession(ctx);
      const timeZone = args.timeZone ?? "UTC";
      if (!isTimeZone(timeZone)) throw apiError("BAD_USER_INPUT", "Unknown timeZone.");
      await setSourcePriority(ctx.db, userId, args.metric, args.dataOrigins);
      return sourcePriority(ctx.db, userId, args.metric, timeZone);
    },
  }),
}));
