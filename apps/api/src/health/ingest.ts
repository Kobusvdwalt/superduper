import { and, eq, max, sql } from "drizzle-orm";

import type { Database, Transaction } from "../db";
import { healthRawRecords, healthRawRecordVersions, syncBatches } from "../db/schema";
import { apiError } from "../graphql/errors";
import { contentHash } from "./hash";
import { reprojectRecord } from "./projection/write";
import type {
  HealthRecordDeletionInput,
  HealthRecordInput,
  HealthSyncInput,
  HealthSyncResult,
} from "./types";
import { validateSyncInput } from "./validate";

type Batch = { id: string; userId: string; clientId: string; schemaVersion: number; at: Date };
type SourceKey = Pick<HealthRecordInput, "origin" | "recordType" | "sourceRecordId">;

function keyWhere(userId: string, key: SourceKey) {
  return and(
    eq(healthRawRecords.userId, userId),
    eq(healthRawRecords.origin, key.origin),
    eq(healthRawRecords.recordType, key.recordType),
    eq(healthRawRecords.sourceRecordId, key.sourceRecordId),
  );
}

async function lockedCurrent(tx: Transaction, userId: string, key: SourceKey) {
  const [row] = await tx
    .select()
    .from(healthRawRecords)
    .where(keyWhere(userId, key))
    .for("update")
    .limit(1);
  return row ?? null;
}

/** The latest deletion received for a source record, including one that arrived first. */
function versionKeyWhere(userId: string, key: SourceKey) {
  return and(
    eq(healthRawRecordVersions.userId, userId),
    eq(healthRawRecordVersions.origin, key.origin),
    eq(healthRawRecordVersions.recordType, key.recordType),
    eq(healthRawRecordVersions.sourceRecordId, key.sourceRecordId),
  );
}

async function latestDeletion(tx: Transaction, userId: string, key: SourceKey) {
  const [row] = await tx
    .select({ deletedAt: max(healthRawRecordVersions.deletedAt) })
    .from(healthRawRecordVersions)
    .where(and(versionKeyWhere(userId, key), eq(healthRawRecordVersions.operation, "DELETE")));
  return row?.deletedAt ?? null;
}

async function seenBefore(tx: Transaction, userId: string, key: SourceKey, hash: string) {
  const [row] = await tx
    .select({ id: healthRawRecordVersions.id })
    .from(healthRawRecordVersions)
    .where(and(versionKeyWhere(userId, key), eq(healthRawRecordVersions.contentHash, hash)))
    .limit(1);
  return row !== undefined;
}

/**
 * A newer `modifiedAt` replaces; an equal one replaces when the content is new for this record,
 * because Health Connect can return richer content (an exercise route once access is granted)
 * without changing the modified time. Content received before never wins back on a tie.
 */
async function replaces(
  tx: Transaction,
  userId: string,
  record: HealthRecordInput,
  current: typeof healthRawRecords.$inferSelect,
  hash: string,
) {
  if (record.modifiedAt > current.modifiedAt) return true;
  if (record.modifiedAt.getTime() !== current.modifiedAt.getTime()) return false;
  if (hash === current.contentHash) return false;
  return !(await seenBefore(tx, userId, record, hash));
}

function stillDeleted(deletedAt: Date | null, modifiedAt: Date): Date | null {
  return deletedAt && modifiedAt <= deletedAt ? deletedAt : null;
}

async function upsertRecord(tx: Transaction, batch: Batch, record: HealthRecordInput) {
  const hash = contentHash(record);
  const envelope = {
    dataOrigin: record.dataOrigin ?? null,
    startTime: record.startTime,
    endTime: record.endTime ?? null,
    startZoneOffsetSeconds: record.startZoneOffsetSeconds ?? null,
    endZoneOffsetSeconds: record.endZoneOffsetSeconds ?? null,
    modifiedAt: record.modifiedAt,
    schemaVersion: batch.schemaVersion,
  };
  const current = await lockedCurrent(tx, batch.userId, record);

  let stored: typeof healthRawRecords.$inferSelect | null = null;
  if (!current) {
    const tombstone = await latestDeletion(tx, batch.userId, record);
    [stored = null] = await tx
      .insert(healthRawRecords)
      .values({
        userId: batch.userId,
        clientId: batch.clientId,
        origin: record.origin,
        recordType: record.recordType,
        sourceRecordId: record.sourceRecordId,
        ...envelope,
        payload: record.payload,
        contentHash: hash,
        deletedAt: stillDeleted(tombstone, record.modifiedAt),
        receivedAt: batch.at,
        syncBatchId: batch.id,
      })
      .returning();
  } else if (await replaces(tx, batch.userId, record, current, hash)) {
    [stored = null] = await tx
      .update(healthRawRecords)
      .set({
        clientId: batch.clientId,
        ...envelope,
        payload: record.payload,
        contentHash: hash,
        deletedAt: stillDeleted(current.deletedAt, record.modifiedAt),
        receivedAt: batch.at,
        syncBatchId: batch.id,
      })
      .where(eq(healthRawRecords.id, current.id))
      .returning();
  }

  await tx
    .insert(healthRawRecordVersions)
    .values({
      userId: batch.userId,
      clientId: batch.clientId,
      origin: record.origin,
      recordType: record.recordType,
      sourceRecordId: record.sourceRecordId,
      rawRecordId: stored?.id ?? current?.id ?? null,
      operation: "UPSERT",
      applied: stored !== null,
      ...envelope,
      payload: record.payload,
      contentHash: hash,
      syncBatchId: batch.id,
      receivedAt: batch.at,
    })
    .onConflictDoNothing();

  if (stored) await reprojectRecord(tx, stored);
}

async function applyDeletion(tx: Transaction, batch: Batch, deletion: HealthRecordDeletionInput) {
  const current = await lockedCurrent(tx, batch.userId, deletion);

  let applied = false;
  if (
    current &&
    deletion.deletedAt >= current.modifiedAt &&
    (!current.deletedAt || deletion.deletedAt > current.deletedAt)
  ) {
    const [stored] = await tx
      .update(healthRawRecords)
      .set({
        clientId: batch.clientId,
        deletedAt: deletion.deletedAt,
        receivedAt: batch.at,
        syncBatchId: batch.id,
      })
      .where(eq(healthRawRecords.id, current.id))
      .returning();
    if (stored) await reprojectRecord(tx, stored);
    applied = true;
  }

  await tx
    .insert(healthRawRecordVersions)
    .values({
      userId: batch.userId,
      clientId: batch.clientId,
      origin: deletion.origin,
      recordType: deletion.recordType,
      sourceRecordId: deletion.sourceRecordId,
      rawRecordId: current?.id ?? null,
      operation: "DELETE",
      applied,
      deletedAt: deletion.deletedAt,
      schemaVersion: batch.schemaVersion,
      contentHash: contentHash({ deletedAt: deletion.deletedAt }),
      syncBatchId: batch.id,
      receivedAt: batch.at,
    })
    .onConflictDoNothing();
}

/**
 * Applies one batch atomically; see docs/health-sync-contract.md for the guarantees. Record
 * identity is per user, so batches of all of a user's clients are serialised by one
 * transaction-scoped advisory lock: two clients pushing the same new record would otherwise race
 * on its insert. The batchId stays scoped to the client that sent it.
 */
export async function ingestHealthBatch(
  db: Database,
  client: { id: string; userId: string },
  input: HealthSyncInput,
): Promise<HealthSyncResult> {
  validateSyncInput(input);
  const hash = contentHash({
    schemaVersion: input.schemaVersion,
    records: input.records,
    deletions: input.deletions,
  });

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`health-sync:${client.userId}`}, 0))`,
    );

    const [existing] = await tx
      .select()
      .from(syncBatches)
      .where(and(eq(syncBatches.clientId, client.id), eq(syncBatches.batchId, input.batchId)))
      .limit(1);
    if (existing) {
      if (existing.domain !== "health" || existing.contentHash !== hash) {
        throw apiError("CONFLICT", "This batchId was already used with different content.");
      }
      return {
        batchId: input.batchId,
        replayed: true,
        acceptedRecords: existing.recordCount,
        acceptedDeletions: existing.deletionCount,
      };
    }

    const at = new Date();
    const [row] = await tx
      .insert(syncBatches)
      .values({
        userId: client.userId,
        clientId: client.id,
        domain: "health",
        batchId: input.batchId,
        schemaVersion: input.schemaVersion,
        contentHash: hash,
        recordCount: input.records.length,
        deletionCount: input.deletions.length,
        receivedAt: at,
      })
      .returning({ id: syncBatches.id });
    if (!row) throw new Error("Insert returned no sync batch.");

    const batch = {
      id: row.id,
      userId: client.userId,
      clientId: client.id,
      schemaVersion: input.schemaVersion,
      at,
    };
    for (const record of input.records) await upsertRecord(tx, batch, record);
    for (const deletion of input.deletions) await applyDeletion(tx, batch, deletion);

    return {
      batchId: input.batchId,
      replayed: false,
      acceptedRecords: input.records.length,
      acceptedDeletions: input.deletions.length,
    };
  });
}
