import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, instant, timestamps } from "./columns";
import { healthRawRecords } from "./health_raw_records";
import { users } from "./users";

export const healthSleepSessions = pgTable(
  "health_sleep_sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawRecordId: uuid("raw_record_id")
      .notNull()
      .unique()
      .references(() => healthRawRecords.id, { onDelete: "cascade" }),
    startTime: instant("start_time").notNull(),
    endTime: instant("end_time").notNull(),
    startZoneOffsetSeconds: integer("start_zone_offset_seconds"),
    endZoneOffsetSeconds: integer("end_zone_offset_seconds"),
    title: text("title"),
    notes: text("notes"),
    dataOrigin: text("data_origin"),
    ...timestamps(),
  },
  (table) => [index("health_sleep_sessions_user_time_idx").on(table.userId, table.startTime)],
);
