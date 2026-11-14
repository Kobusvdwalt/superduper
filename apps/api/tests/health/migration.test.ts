import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../../drizzle/", import.meta.url).pathname;
const TARGET = "_health_identity_per_user";

async function apply(db: PGlite, folder: string) {
  const text = await Bun.file(join(MIGRATIONS, folder, "migration.sql")).text();
  for (const statement of text.split("--> statement-breakpoint")) await db.exec(statement);
}

const USER = "00000000-0000-7000-8000-000000000001";
const PHONE = "00000000-0000-7000-8000-0000000000c1";
const REPAIRED = "00000000-0000-7000-8000-0000000000c2";
const BATCH_1 = "00000000-0000-7000-8000-0000000000b1";
const BATCH_2 = "00000000-0000-7000-8000-0000000000b2";
const row = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/** A raw record plus one quantity sample projected from it. */
function record(
  id: string,
  client: string,
  batch: string,
  source: string,
  modifiedAt: string,
  receivedAt: string,
  count: number,
  deletedAt: string | null = null,
) {
  return `
    INSERT INTO health_raw_records (id, user_id, client_id, origin, record_type, source_record_id,
      data_origin, start_time, modified_at, schema_version, payload, content_hash, deleted_at,
      received_at, sync_batch_id)
    VALUES ('${id}', '${USER}', '${client}', 'HEALTH_CONNECT', 'StepsRecord', '${source}',
      'com.example', '2026-11-10T06:00:00Z', '${modifiedAt}', 1, '{"count": ${count}}',
      'hash-${count}', ${deletedAt ? `'${deletedAt}'` : "NULL"}, '${receivedAt}', '${batch}');
    ${
      deletedAt
        ? ""
        : `INSERT INTO health_quantity_samples (user_id, raw_record_id, metric, start_time, value, unit)
           VALUES ('${USER}', '${id}', 'STEPS', '2026-11-10T06:00:00Z', ${count}, 'count');`
    }`;
}

function version(
  rawRecordId: string,
  client: string,
  batch: string,
  source: string,
  count: number,
  receivedAt: string,
  applied = true,
) {
  return `
    INSERT INTO health_raw_record_versions (user_id, client_id, origin, record_type,
      source_record_id, raw_record_id, operation, applied, schema_version, payload, content_hash,
      sync_batch_id, received_at)
    VALUES ('${USER}', '${client}', 'HEALTH_CONNECT', 'StepsRecord', '${source}', '${rawRecordId}',
      'UPSERT', ${applied}, 1, '{"count": ${count}}', 'hash-${count}', '${batch}', '${receivedAt}');`;
}

describe(`migration ${TARGET}`, () => {
  let db: PGlite;
  let untouchedBefore: unknown;

  beforeAll(async () => {
    db = await PGlite.create();
    const folders = readdirSync(MIGRATIONS).sort();
    const target = folders.findIndex((folder) => folder.endsWith(TARGET));
    expect(target).toBeGreaterThan(0);
    for (const folder of folders.slice(0, target)) await apply(db, folder);

    await db.exec(`
      INSERT INTO users (id, name, email) VALUES ('${USER}', 'Owner', 'owner@example.com');
      INSERT INTO clients (id, user_id, name, kind, token_hash) VALUES
        ('${PHONE}', '${USER}', 'Phone', 'DEVICE', 'a'),
        ('${REPAIRED}', '${USER}', 'Phone, paired again', 'DEVICE', 'b');
      INSERT INTO sync_batches (id, user_id, client_id, domain, batch_id, schema_version,
        content_hash, record_count, deletion_count) VALUES
        ('${BATCH_1}', '${USER}', '${PHONE}', 'health', gen_random_uuid(), 1, 'x', 0, 0),
        ('${BATCH_2}', '${USER}', '${REPAIRED}', 'health', gen_random_uuid(), 1, 'y', 0, 0);
      ${record(row(1), PHONE, BATCH_1, "dup", "2026-11-10T08:00:00Z", "2026-11-11T00:00:00Z", 100)}
      ${record(row(2), REPAIRED, BATCH_2, "dup", "2026-11-10T09:00:00Z", "2026-11-12T00:00:00Z", 120)}
      ${version(row(1), PHONE, BATCH_1, "dup", 100, "2026-11-11T00:00:00Z")}
      ${version(row(2), REPAIRED, BATCH_2, "dup", 100, "2026-11-12T00:00:00Z", false)}
      ${version(row(2), REPAIRED, BATCH_2, "dup", 120, "2026-11-12T00:00:01Z")}
      ${record(row(3), PHONE, BATCH_1, "deleted", "2026-11-10T08:00:00Z", "2026-11-11T00:00:00Z", 7, "2026-11-10T10:00:00Z")}
      ${record(row(4), REPAIRED, BATCH_2, "deleted", "2026-11-10T08:00:00Z", "2026-11-12T00:00:00Z", 8)}
      ${record(row(5), PHONE, BATCH_1, "single", "2026-11-10T08:00:00Z", "2026-11-11T00:00:00Z", 50)}
      ${version(row(5), PHONE, BATCH_1, "single", 50, "2026-11-11T00:00:00Z")}
    `);
    untouchedBefore = (
      await db.query(`SELECT * FROM health_raw_records WHERE source_record_id = 'single'`)
    ).rows;

    await apply(db, folders[target]!);
  });

  afterAll(async () => {
    await db.close();
  });

  const rows = async <T>(query: string) => (await db.query<T>(query)).rows;

  test("keeps the duplicate with the newest modifiedAt", async () => {
    expect(
      await rows(
        `SELECT id, source_record_id, client_id, payload FROM health_raw_records ORDER BY id`,
      ),
    ).toEqual([
      { id: row(2), source_record_id: "dup", client_id: REPAIRED, payload: { count: 120 } },
      { id: row(4), source_record_id: "deleted", client_id: REPAIRED, payload: { count: 8 } },
      { id: row(5), source_record_id: "single", client_id: PHONE, payload: { count: 50 } },
    ]);
  });

  test("keeps every distinct version under the survivor, the first receipt of each", async () => {
    expect(
      await rows(
        `SELECT raw_record_id, client_id, content_hash, applied FROM health_raw_record_versions
         WHERE source_record_id = 'dup' ORDER BY received_at`,
      ),
    ).toEqual([
      { raw_record_id: row(2), client_id: PHONE, content_hash: "hash-100", applied: true },
      { raw_record_id: row(2), client_id: REPAIRED, content_hash: "hash-120", applied: true },
    ]);
  });

  test("a deletion on a merged duplicate still applies, and its projection goes", async () => {
    const [deleted] = await rows<{ deleted_at: Date }>(
      `SELECT deleted_at FROM health_raw_records WHERE id = '${row(4)}'`,
    );
    expect(deleted?.deleted_at).toEqual(new Date("2026-11-10T10:00:00Z"));
    expect(
      await rows(`SELECT raw_record_id, value FROM health_quantity_samples ORDER BY raw_record_id`),
    ).toEqual([
      { raw_record_id: row(2), value: 120 },
      { raw_record_id: row(5), value: 50 },
    ]);
  });

  test("leaves records without duplicates exactly as they were", async () => {
    expect(
      await rows(`SELECT * FROM health_raw_records WHERE source_record_id = 'single'`),
    ).toEqual(untouchedBefore as never[]);
  });

  test("identity is per user afterwards, and deleting a client keeps the data", async () => {
    expect(
      db.exec(`
        INSERT INTO health_raw_records (user_id, client_id, origin, record_type, source_record_id,
          start_time, modified_at, schema_version, payload, content_hash, received_at, sync_batch_id)
        VALUES ('${USER}', '${PHONE}', 'HEALTH_CONNECT', 'StepsRecord', 'dup', now(), now(), 1,
          '{}', 'z', now(), '${BATCH_1}')`),
    ).rejects.toThrow(/health_raw_records_source_key/);

    await db.exec(`DELETE FROM clients`);
    expect(
      await rows(
        `SELECT (SELECT count(*)::int FROM health_raw_records) AS records,
                (SELECT count(*)::int FROM health_raw_record_versions) AS versions,
                (SELECT count(*)::int FROM sync_batches) AS batches,
                (SELECT count(*)::int FROM health_raw_records WHERE client_id IS NOT NULL) AS owned`,
      ),
    ).toEqual([{ records: 3, versions: 3, batches: 2, owned: 0 }]);
  });
});
