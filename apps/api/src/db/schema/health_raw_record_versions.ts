import { boolean, index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { clients } from "./clients";
import { createdAt, id, instant, jsonb } from "./columns";
import { healthOrigin, healthRawRecords } from "./health_raw_records";
import { syncBatches } from "./sync_batches";
import { users } from "./users";

export const healthRecordOperation = pgEnum("health_record_operation", ["UPSERT", "DELETE"]);

/**
 * Append-only history of every distinct record and deletion received, whether or not it became
 * current (`applied`). Keyed by the source identity rather than only `raw_record_id`, because a
 * deletion can arrive before the record it deletes.
 */
export const healthRawRecordVersions = pgTable(
  "health_raw_record_versions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The client this version was received from; null once that client is deleted. */
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    origin: healthOrigin("origin").notNull(),
    recordType: text("record_type").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    rawRecordId: uuid("raw_record_id").references(() => healthRawRecords.id, {
      onDelete: "set null",
    }),
    operation: healthRecordOperation("operation").notNull(),
    applied: boolean("applied").notNull(),
    dataOrigin: text("data_origin"),
    startTime: instant("start_time"),
    endTime: instant("end_time"),
    startZoneOffsetSeconds: integer("start_zone_offset_seconds"),
    endZoneOffsetSeconds: integer("end_zone_offset_seconds"),
    modifiedAt: instant("modified_at"),
    deletedAt: instant("deleted_at"),
    schemaVersion: integer("schema_version").notNull(),
    payload: jsonb<Record<string, unknown>>("payload"),
    contentHash: text("content_hash").notNull(),
    syncBatchId: uuid("sync_batch_id")
      .notNull()
      .references(() => syncBatches.id),
    receivedAt: instant("received_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("health_raw_record_versions_content_key").on(
      table.userId,
      table.origin,
      table.recordType,
      table.sourceRecordId,
      table.contentHash,
    ),
    index("health_raw_record_versions_raw_record_idx").on(table.rawRecordId),
  ],
);
