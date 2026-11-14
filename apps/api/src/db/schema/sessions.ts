import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, instant, timestamps } from "./columns";
import { users } from "./users";

/** Better Auth's session model: one signed-in browser. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: instant("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);
