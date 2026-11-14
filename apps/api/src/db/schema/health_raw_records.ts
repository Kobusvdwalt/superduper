import { index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { clients } from "./clients";
import { id, instant, jsonb, timestamps } from "./columns";
import { syncBatches } from "./sync_batches";
import { users } from "./users";

export const healthOrigin = pgEnum("health_origin", ["HEALTH_CONNECT"]);

/**
 * The current version of every pushed health record, stored losslessly. The typed `health_*`
 * tables are a projection of this one. A record's identity is per user, not per client: the same
 * source record pushed by a second client (a re-paired phone) is the same row.
 */
export const healthRawRecords = pgTable(
  "health_raw_records",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The client this version of the record was last received from; null once it is deleted. */
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    origin: healthOrigin("origin").notNull(),
    recordType: text("record_type").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    dataOrigin: text("data_origin"),
    startTime: instant("start_time").notNull(),
    endTime: instant("end_time"),
    startZoneOffsetSeconds: integer("start_zone_offset_seconds"),
    endZoneOffsetSeconds: integer("end_zone_offset_seconds"),
    modifiedAt: instant("modified_at").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    payload: jsonb<Record<string, unknown>>("payload").notNull(),
    contentHash: text("content_hash").notNull(),
    deletedAt: instant("deleted_at"),
    receivedAt: instant("received_at").notNull(),
    syncBatchId: uuid("sync_batch_id")
      .notNull()
      .references(() => syncBatches.id),
    projectedAt: instant("projected_at"),
    projectionError: text("projection_error"),
    ...timestamps(),
  },
  (table) => [
    unique("health_raw_records_source_key").on(
      table.userId,
      table.origin,
      table.recordType,
      table.sourceRecordId,
    ),
    index("health_raw_records_user_type_time_idx").on(
      table.userId,
      table.recordType,
      table.startTime,
    ),
    index("health_raw_records_sync_batch_idx").on(table.syncBatchId),
  ],
);
