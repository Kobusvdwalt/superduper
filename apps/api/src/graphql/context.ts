import type { Auth } from "../auth/better_auth";
import { bearerToken, clientForToken } from "../auth/client_tokens";
import type { Database } from "../db";
import type { clients } from "../db/schema";
import { apiError } from "./errors";

type Client = typeof clients.$inferSelect;

/** Who is calling: a signed-in web session, or a client acting for its user. */
export type Viewer =
  | { kind: "session"; userId: string; sessionId: string }
  | { kind: "client"; userId: string; client: Client };

export type GraphQLContext = {
  db: Database;
  viewer: Viewer | null;
};

/**
 * A request carrying a bearer header is authenticated by that token alone, so a stale cookie
 * cannot turn a revoked client into a session.
 */
export async function createGraphQLContext(
  db: Database,
  auth: Auth,
  request: Request,
): Promise<GraphQLContext> {
  const token = bearerToken(request);
  if (token !== null) {
    const client = await clientForToken(db, token);
    return { db, viewer: client ? { kind: "client", userId: client.userId, client } : null };
  }

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  return {
    db,
    viewer: session
      ? { kind: "session", userId: session.user.id, sessionId: session.session.id }
      : null,
  };
}

export function requireViewer(ctx: GraphQLContext): Viewer {
  if (!ctx.viewer) throw apiError("UNAUTHENTICATED", "Sign in or send a client token.");
  return ctx.viewer;
}

export function requireSession(ctx: GraphQLContext): Extract<Viewer, { kind: "session" }> {
  const viewer = requireViewer(ctx);
  if (viewer.kind !== "session") throw apiError("FORBIDDEN", "This requires a signed-in session.");
  return viewer;
}

export function requireClient(ctx: GraphQLContext): Extract<Viewer, { kind: "client" }> {
  const viewer = requireViewer(ctx);
  if (viewer.kind !== "client") throw apiError("FORBIDDEN", "Only clients may push data.");
  return viewer;
}
