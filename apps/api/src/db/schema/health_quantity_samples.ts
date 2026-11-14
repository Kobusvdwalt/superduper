import { doublePrecision, index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, id, instant } from "./columns";
import { healthRawRecords } from "./health_raw_records";
import { users } from "./users";

export const HEALTH_METRICS = [
  "STEPS",
  "DISTANCE",
  "FLOORS_CLIMBED",
  "ELEVATION_GAINED",
  "WHEELCHAIR_PUSHES",
  "ACTIVE_ENERGY_BURNED",
  "TOTAL_ENERGY_BURNED",
  "BASAL_METABOLIC_RATE",
  "HEART_RATE",
  "RESTING_HEART_RATE",
  "HEART_RATE_VARIABILITY_RMSSD",
  "OXYGEN_SATURATION",
  "RESPIRATORY_RATE",
  "VO2_MAX",
  "WEIGHT",
  "HEIGHT",
  "BODY_FAT",
  "LEAN_BODY_MASS",
  "BONE_MASS",
  "BODY_WATER_MASS",
  "BODY_TEMPERATURE",
  "BASAL_BODY_TEMPERATURE",
  "SKIN_TEMPERATURE_BASELINE",
  "SKIN_TEMPERATURE_DELTA",
  "BLOOD_GLUCOSE",
  "BLOOD_PRESSURE_SYSTOLIC",
  "BLOOD_PRESSURE_DIASTOLIC",
  "HYDRATION",
  "SPEED",
  "POWER",
  "CYCLING_PEDALING_CADENCE",
  "STEPS_CADENCE",
] as const;

export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const healthMetric = pgEnum("health_metric", HEALTH_METRICS);

/**
 * One numeric measurement in the metric's canonical unit. Series records are flattened to one
 * row per sample; `end_time` is null for instants.
 */
export const healthQuantitySamples = pgTable(
  "health_quantity_samples",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawRecordId: uuid("raw_record_id")
      .notNull()
      .references(() => healthRawRecords.id, { onDelete: "cascade" }),
    metric: healthMetric("metric").notNull(),
    startTime: instant("start_time").notNull(),
    endTime: instant("end_time"),
    value: doublePrecision("value").notNull(),
    unit: text("unit").notNull(),
    dataOrigin: text("data_origin"),
    createdAt: createdAt(),
  },
  (table) => [
    index("health_quantity_samples_user_metric_time_idx").on(
      table.userId,
      table.metric,
      table.startTime,
    ),
    index("health_quantity_samples_raw_record_idx").on(table.rawRecordId),
  ],
);
