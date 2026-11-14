import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, instant, timestamps } from "./columns";
import { users } from "./users";

/** Better Auth's account model; `password` holds the credential hash. */
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    ...timestamps(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);
