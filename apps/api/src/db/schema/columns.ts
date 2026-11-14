import { sql } from "drizzle-orm";
import { customType, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`);

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const instant = (name: string) => timestamp(name, { withTimezone: true });

/** Bun's SQL driver sends a JS object as text; the explicit cast keeps it a JSON value. */
export const jsonb = <T>(name: string) =>
  customType<{ data: T; driverData: T }>({
    dataType: () => "jsonb",
    toDriver: (value: T) => sql`${JSON.stringify(value)}::text::jsonb`,
  })(name);
