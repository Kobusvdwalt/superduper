import { doublePrecision, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, instant, jsonb, timestamps } from "./columns";
import { healthRawRecords } from "./health_raw_records";
import { users } from "./users";

/** Nutrient name to amount, in grams (or kilocalories for `energyFromFat`). */
export type NutrientAmounts = Record<string, number>;

/** One logged food or meal. Macros are columns; every other nutrient is in `nutrients`. */
export const healthNutritionEntries = pgTable(
  "health_nutrition_entries",
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
    mealType: text("meal_type"),
    name: text("name"),
    energyKilocalories: doublePrecision("energy_kilocalories"),
    proteinGrams: doublePrecision("protein_grams"),
    totalCarbohydrateGrams: doublePrecision("total_carbohydrate_grams"),
    totalFatGrams: doublePrecision("total_fat_grams"),
    dietaryFiberGrams: doublePrecision("dietary_fiber_grams"),
    sugarGrams: doublePrecision("sugar_grams"),
    nutrients: jsonb<NutrientAmounts>("nutrients").notNull(),
    dataOrigin: text("data_origin"),
    ...timestamps(),
  },
  (table) => [index("health_nutrition_entries_user_time_idx").on(table.userId, table.startTime)],
);
