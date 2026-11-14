import { Elysia } from "elysia";

import { createAuth } from "./auth/better_auth";
import type { Database } from "./db";
import { graphqlRoutes } from "./graphql/route";

export function createApp(db: Database) {
  const auth = createAuth(db);

  return new Elysia()
    .all("/api/auth/*", ({ request }) => auth.handler(request))
    .group("/api", (app) => app.get("/healthz", () => ({ ok: true })).use(graphqlRoutes(db, auth)));
}
