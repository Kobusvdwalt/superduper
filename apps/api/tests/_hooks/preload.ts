import { afterAll } from "bun:test";

import { env } from "../../src/env";
import { stopSharedPostgres } from "./database";

env.BETTER_AUTH_SECRET ??= "test-only-secret-not-for-production-use";
env.OWNER_EMAIL = "owner@example.com";
env.LOG_LEVEL = "error";

afterAll(async () => {
  await stopSharedPostgres();
});
