import { builder } from "../builder";
import { HealthOriginEnum } from "./types";

const HealthRecordInput = builder.inputType("HealthRecordInput", {
  description: "One record as read from the origin. See docs/health-sync-contract.md.",
  fields: (t) => ({
    origin: t.field({ type: HealthOriginEnum, required: true }),
    recordType: t.string({ required: true, description: "For example `HeartRateRecord`." }),
    sourceRecordId: t.string({ required: true }),
    dataOrigin: t.string({ required: false }),
    startTime: t.field({ type: "DateTime", required: true }),
    endTime: t.field({ type: "DateTime", required: false }),
    startZoneOffsetSeconds: t.int({ required: false }),
    endZoneOffsetSeconds: t.int({ required: false }),
    modifiedAt: t.field({ type: "DateTime", required: true }),
    payload: t.field({ type: "JSON", required: true }),
  }),
});

const HealthRecordDeletionInput = builder.inputType("HealthRecordDeletionInput", {
  fields: (t) => ({
    origin: t.field({ type: HealthOriginEnum, required: true }),
    recordType: t.string({ required: true }),
    sourceRecordId: t.string({ required: true }),
    deletedAt: t.field({ type: "DateTime", required: true }),
  }),
});

export const HealthSyncInput = builder.inputType("HealthSyncInput", {
  fields: (t) => ({
    batchId: t.field({ type: "UUID", required: true }),
    schemaVersion: t.int({ required: true }),
    records: t.field({ type: [HealthRecordInput], required: true }),
    deletions: t.field({ type: [HealthRecordDeletionInput], required: true }),
  }),
});
