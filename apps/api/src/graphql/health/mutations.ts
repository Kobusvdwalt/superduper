import { ingestHealthBatch } from "../../health/ingest";
import { builder } from "../builder";
import { requireClient } from "../context";
import { HealthSyncInput } from "./inputs";
import { Health, HealthSyncResultType } from "./types";

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
}));
