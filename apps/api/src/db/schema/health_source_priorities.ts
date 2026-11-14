import { pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { id, timestamps } from "./columns";
import { healthMetric } from "./health_quantity_samples";
import { users } from "./users";

/**
 * A user's preferred order of data origins for one cumulative metric, highest priority first.
 * Origins not listed rank after the listed ones by the default ranking.
 */
export const healthSourcePriorities = pgTable(
  "health_source_priorities",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: healthMetric("metric").notNull(),
    dataOrigins: text("data_origins").array().notNull(),
    ...timestamps(),
  },
  (table) => [unique("health_source_priorities_user_metric_key").on(table.userId, table.metric)],
);
