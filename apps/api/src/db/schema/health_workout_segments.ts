import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, id, instant } from "./columns";
import { healthWorkouts } from "./health_workouts";

export const healthWorkoutSegments = pgTable(
  "health_workout_segments",
  {
    id: id(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => healthWorkouts.id, { onDelete: "cascade" }),
    segmentType: text("segment_type").notNull(),
    repetitions: integer("repetitions"),
    startTime: instant("start_time").notNull(),
    endTime: instant("end_time").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("health_workout_segments_workout_idx").on(table.workoutId, table.startTime)],
);
