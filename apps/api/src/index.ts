import { createApp } from "./app";
import { createDatabase, createDrizzleDb } from "./db";
import { runMigrations } from "./db/migrate";
import { env, requireEnv } from "./env";
import { log } from "./logger";

requireEnv(["BETTER_AUTH_SECRET"]);
if (!env.OWNER_EMAIL) log.info("OWNER_EMAIL is not set; sign-up is disabled");

const client = createDatabase(env.DATABASE_URL, env.DATABASE_POOL_MAX);
await runMigrations(client, log);

const app = createApp(createDrizzleDb(client)).listen({ port: env.API_PORT, hostname: "0.0.0.0" });
log.info("API listening", { url: `http://localhost:${app.server?.port}/api/graphql` });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void (async () => {
      await app.stop();
      await client.close();
      process.exit(0);
    })();
  });
}
