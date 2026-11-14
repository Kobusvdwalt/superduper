import { index, pgTable, text } from "drizzle-orm/pg-core";

import { id, instant, timestamps } from "./columns";

/** Better Auth's verification model. */
export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instant("expires_at").notNull(),
    ...timestamps(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);
