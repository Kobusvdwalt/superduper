import { index, integer, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, instant, timestamps } from "./columns";
import { healthRawRecords } from "./health_raw_records";
import { users } from "./users";

export const healthRouteStatus = pgEnum("health_route_status", [
  "DATA",
  "NO_DATA",
  "CONSENT_REQUIRED",
]);

/** An exercise session. `activity_type` is the origin's constant name, e.g. `RUNNING`. */
export const healthWorkouts = pgTable(
  "health_workouts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawRecordId: uuid("raw_record_id")
      .notNull()
      .unique()
      .references(() => healthRawRecords.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(),
    title: text("title"),
    notes: text("notes"),
    startTime: instant("start_time").notNull(),
    endTime: instant("end_time").notNull(),
    startZoneOffsetSeconds: integer("start_zone_offset_seconds"),
    endZoneOffsetSeconds: integer("end_zone_offset_seconds"),
    routeStatus: healthRouteStatus("route_status"),
    dataOrigin: text("data_origin"),
    ...timestamps(),
  },
  (table) => [index("health_workouts_user_time_idx").on(table.userId, table.startTime)],
);
