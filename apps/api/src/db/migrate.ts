import type { SQL } from "bun";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { createDrizzleDb } from ".";

const MIGRATION_LOCK_KEY = 7_303_317_100;
const MIGRATIONS_FOLDER = new URL("../../drizzle", import.meta.url).pathname;

/** Serialised by an advisory lock so several API replicas can start at once. */
export async function runMigrations(
  client: SQL,
  log: { info: (message: string) => void },
): Promise<void> {
  const lock = await client.reserve();

  try {
    log.info("Waiting for the migration lock");
    await lock`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY}::bigint)`;
    await migrate(createDrizzleDb(lock), { migrationsFolder: MIGRATIONS_FOLDER });
    log.info("Migrations up to date");
  } finally {
    await lock`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY}::bigint)`;
    lock.release();
  }
}
