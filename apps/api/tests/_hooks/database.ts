import { beforeAll, afterAll } from "bun:test";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { SQL } from "bun";

import { createDrizzleDb, type Database } from "../../src/db";
import { runMigrations } from "../../src/db/migrate";

type SharedPostgres = { url: string; pglite: PGlite; server: PGLiteSocketServer };

/**
 * Relies on bun:test running files one at a time; run concurrently, they would reset each
 * other's data mid-test.
 */
let shared: Promise<SharedPostgres> | undefined;

// Compiling the WASM in CI can take longer than bun's default 5s hook timeout.
const BOOT_TIMEOUT_MS = 60_000;
const POOL_MAX = 5;
const quiet = { info: () => {} };

async function startPostgres(): Promise<SharedPostgres> {
  const pglite = await PGlite.create();
  const server = new PGLiteSocketServer({
    db: pglite,
    port: 0,
    host: "127.0.0.1",
    maxConnections: POOL_MAX * 2,
  });
  await server.start();
  return { url: `postgres://postgres@${server.getServerConn()}/postgres`, pglite, server };
}

/** Bun exits 99 while a PGlite instance is still open, however green the run. */
export async function stopSharedPostgres(): Promise<void> {
  if (!shared) return;
  const { pglite, server } = await shared;
  await server.stop();
  await pglite.close();
}

/** Drops every schema (drizzle's migration journal included) and migrates from scratch. */
async function reset(postgres: SharedPostgres, client: SQL) {
  await postgres.pglite.exec(`
    DEALLOCATE ALL;
    DO $$
    DECLARE target text;
    BEGIN
      FOR target IN
        SELECT nspname FROM pg_namespace
        WHERE nspname <> 'information_schema' AND nspname NOT LIKE 'pg\\_%'
      LOOP
        EXECUTE format('DROP SCHEMA %I CASCADE', target);
      END LOOP;
      CREATE SCHEMA public;
    END $$;
  `);
  await runMigrations(client, quiet);
}

export type TestDatabase = { client: SQL; db: Database };

export function useDatabase(): TestDatabase {
  const database = {} as TestDatabase;
  let client: SQL | undefined;

  beforeAll(
    async () => {
      const postgres = await (shared ??= startPostgres());
      client = new SQL({ url: postgres.url, max: POOL_MAX, prepare: false });
      await reset(postgres, client);
      Object.assign(database, { client, db: createDrizzleDb(client) });
    },
    { timeout: BOOT_TIMEOUT_MS },
  );

  afterAll(async () => {
    await client?.close();
  });

  return database;
}
