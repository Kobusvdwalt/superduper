import { and, asc, eq, gt, type SQL } from "drizzle-orm";

import type { Database } from "../../db";
import { healthRawRecords } from "../../db/schema";
import { reprojectRecord } from "./write";

const CHUNK = 200;

/**
 * Rebuilds the typed tables from the raw archive, a chunk per transaction, in id order.
 * Returns how many records were reprojected and how many failed to project.
 */
export async function reprojectAll(
  db: Database,
  options: { userId?: string; recordType?: string } = {},
): Promise<{ records: number; errors: number }> {
  let records = 0;
  let errors = 0;
  let after: string | null = null;

  for (;;) {
    const filters: (SQL | undefined)[] = [
      options.userId ? eq(healthRawRecords.userId, options.userId) : undefined,
      options.recordType ? eq(healthRawRecords.recordType, options.recordType) : undefined,
      after ? gt(healthRawRecords.id, after) : undefined,
    ];
    const chunk = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(healthRawRecords)
        .where(and(...filters))
        .orderBy(asc(healthRawRecords.id))
        .limit(CHUNK)
        .for("update");
      let failed = 0;
      for (const row of rows) if ((await reprojectRecord(tx, row)) !== null) failed += 1;
      return { rows, failed };
    });

    records += chunk.rows.length;
    errors += chunk.failed;
    after = chunk.rows.at(-1)?.id ?? null;
    if (chunk.rows.length < CHUNK) return { records, errors };
  }
}
