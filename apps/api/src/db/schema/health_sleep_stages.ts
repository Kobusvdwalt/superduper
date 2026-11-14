import { index, pgEnum, pgTable, uuid } from "drizzle-orm/pg-core";

import { createdAt, id, instant } from "./columns";
import { healthSleepSessions } from "./health_sleep_sessions";

export const HEALTH_SLEEP_STAGES = [
  "UNKNOWN",
  "AWAKE",
  "AWAKE_IN_BED",
  "OUT_OF_BED",
  "SLEEPING",
  "LIGHT",
  "DEEP",
  "REM",
] as const;

export const healthSleepStage = pgEnum("health_sleep_stage", HEALTH_SLEEP_STAGES);

export const healthSleepStages = pgTable(
  "health_sleep_stages",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => healthSleepSessions.id, { onDelete: "cascade" }),
    stage: healthSleepStage("stage").notNull(),
    startTime: instant("start_time").notNull(),
    endTime: instant("end_time").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("health_sleep_stages_session_idx").on(table.sessionId, table.startTime)],
);
