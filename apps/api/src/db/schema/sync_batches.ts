import { index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { clients } from "./clients";
import { id, instant, timestamps } from "./columns";
import { users } from "./users";

/** One acknowledged sync batch; `(client_id, batch_id)` is the idempotency key. */
export const syncBatches = pgTable(
  "sync_batches",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    batchId: uuid("batch_id").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    contentHash: text("content_hash").notNull(),
    recordCount: integer("record_count").notNull(),
    deletionCount: integer("deletion_count").notNull(),
    receivedAt: instant("received_at").notNull().defaultNow(),
    ...timestamps(),
  },
  (table) => [
    unique("sync_batches_client_batch_key").on(table.clientId, table.batchId),
    index("sync_batches_user_received_idx").on(table.userId, table.receivedAt),
  ],
);
