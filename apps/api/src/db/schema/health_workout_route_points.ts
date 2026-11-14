import { doublePrecision, index, pgTable, uuid } from "drizzle-orm/pg-core";

import { createdAt, id, instant } from "./columns";
import { healthWorkouts } from "./health_workouts";

export const healthWorkoutRoutePoints = pgTable(
  "health_workout_route_points",
  {
    id: id(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => healthWorkouts.id, { onDelete: "cascade" }),
    time: instant("time").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    altitudeMeters: doublePrecision("altitude_meters"),
    horizontalAccuracyMeters: doublePrecision("horizontal_accuracy_meters"),
    verticalAccuracyMeters: doublePrecision("vertical_accuracy_meters"),
    createdAt: createdAt(),
  },
  (table) => [index("health_workout_route_points_workout_idx").on(table.workoutId, table.time)],
);
