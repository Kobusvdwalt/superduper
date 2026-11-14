import { doublePrecision, index, pgTable, uuid } from "drizzle-orm/pg-core";

import { createdAt, id, instant } from "./columns";
import { healthWorkouts } from "./health_workouts";

export const healthWorkoutLaps = pgTable(
  "health_workout_laps",
  {
    id: id(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => healthWorkouts.id, { onDelete: "cascade" }),
    startTime: instant("start_time").notNull(),
    endTime: instant("end_time").notNull(),
    lengthMeters: doublePrecision("length_meters"),
    createdAt: createdAt(),
  },
  (table) => [index("health_workout_laps_workout_idx").on(table.workoutId, table.startTime)],
);
