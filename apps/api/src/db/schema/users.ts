import { boolean, pgTable, text } from "drizzle-orm/pg-core";

import { id, timestamps } from "./columns";

/** Better Auth's user model. */
export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps(),
});
