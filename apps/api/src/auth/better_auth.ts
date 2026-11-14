import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { Database } from "../db";
import * as schema from "../db/schema";
import { env, requireEnv } from "../env";

export function createAuth(db: Database) {
  const { BETTER_AUTH_SECRET } = requireEnv(["BETTER_AUTH_SECRET"]);

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: BETTER_AUTH_SECRET,
    trustedOrigins: env.AUTH_TRUSTED_ORIGINS,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    advanced: { database: { generateId: false } },
    user: { modelName: "users" },
    session: { modelName: "sessions" },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    emailAndPassword: { enabled: true, autoSignIn: true },
    databaseHooks: {
      user: {
        create: {
          before: (user) => {
            if (!env.OWNER_EMAIL || user.email.toLowerCase() !== env.OWNER_EMAIL) {
              throw new APIError("FORBIDDEN", { message: "Sign-up is limited to the owner." });
            }
            return Promise.resolve({ data: user });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
