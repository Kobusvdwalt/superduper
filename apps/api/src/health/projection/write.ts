import { eq } from "drizzle-orm";

import type { Executor, Transaction } from "../../db";
import {
  healthNutritionEntries,
  healthQuantitySamples,
  healthRawRecords,
  healthSleepSessions,
  healthSleepStages,
  healthWorkoutLaps,
  healthWorkoutRoutePoints,
  healthWorkouts,
  healthWorkoutSegments,
} from "../../db/schema";
import { HEALTH_METRIC_UNITS, project, type Projection } from "./project";

type RawRecord = typeof healthRawRecords.$inferSelect;

const INSERT_CHUNK = 1_000;

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let at = 0; at < rows.length; at += INSERT_CHUNK) {
    await insert(rows.slice(at, at + INSERT_CHUNK));
  }
}

async function clearProjection(tx: Executor, rawRecordId: string) {
  await tx.delete(healthQuantitySamples).where(eq(healthQuantitySamples.rawRecordId, rawRecordId));
  await tx.delete(healthSleepSessions).where(eq(healthSleepSessions.rawRecordId, rawRecordId));
  await tx.delete(healthWorkouts).where(eq(healthWorkouts.rawRecordId, rawRecordId));
  await tx
    .delete(healthNutritionEntries)
    .where(eq(healthNutritionEntries.rawRecordId, rawRecordId));
}

async function insertProjection(tx: Transaction, raw: RawRecord, projection: Projection) {
  const owner = { userId: raw.userId, rawRecordId: raw.id, dataOrigin: raw.dataOrigin };

  await insertChunked(projection.quantities, (chunk) =>
    tx
      .insert(healthQuantitySamples)
      .values(chunk.map((row) => ({ ...owner, ...row, unit: HEALTH_METRIC_UNITS[row.metric] }))),
  );

  if (projection.sleep) {
    const { stages, ...session } = projection.sleep;
    const [row] = await tx
      .insert(healthSleepSessions)
      .values({ ...owner, ...session })
      .returning({ id: healthSleepSessions.id });
    if (row && stages.length > 0) {
      await tx.insert(healthSleepStages).values(stages.map((s) => ({ ...s, sessionId: row.id })));
    }
  }

  if (projection.workout) {
    const { segments, laps, route, ...workout } = projection.workout;
    const [row] = await tx
      .insert(healthWorkouts)
      .values({ ...owner, ...workout })
      .returning({ id: healthWorkouts.id });
    if (row) {
      const workoutId = row.id;
      if (segments.length > 0) {
        await tx.insert(healthWorkoutSegments).values(segments.map((s) => ({ ...s, workoutId })));
      }
      if (laps.length > 0) {
        await tx.insert(healthWorkoutLaps).values(laps.map((lap) => ({ ...lap, workoutId })));
      }
      await insertChunked(route, (chunk) =>
        tx.insert(healthWorkoutRoutePoints).values(chunk.map((p) => ({ ...p, workoutId }))),
      );
    }
  }

  if (projection.nutrition) {
    await tx.insert(healthNutritionEntries).values({ ...owner, ...projection.nutrition });
  }
}

/**
 * Replaces the typed rows built from one raw record. Runs in a savepoint and records a failure
 * on the raw row instead of throwing, so a bad payload never rejects or loses the record.
 * Returns that failure, or null.
 */
export async function reprojectRecord(tx: Transaction, raw: RawRecord): Promise<string | null> {
  await clearProjection(tx, raw.id);

  let error: string | null = null;
  if (!raw.deletedAt) {
    try {
      await tx.transaction(async (savepoint) => {
        const projection = project(raw.origin, raw);
        if (projection) await insertProjection(savepoint, raw, projection);
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  await tx
    .update(healthRawRecords)
    .set({ projectedAt: error ? null : new Date(), projectionError: error })
    .where(eq(healthRawRecords.id, raw.id));
  return error;
}
