import { index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, instant, timestamps } from "./columns";
import { users } from "./users";

export const clientKind = pgEnum("client_kind", ["DEVICE", "CONNECTOR"]);

/** A device or connector that pushes data with its own bearer token. */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: clientKind("kind").notNull(),
    platform: text("platform"),
    tokenHash: text("token_hash").notNull().unique(),
    lastSeenAt: instant("last_seen_at"),
    revokedAt: instant("revoked_at"),
    ...timestamps(),
  },
  (table) => [index("clients_user_id_idx").on(table.userId)],
);
