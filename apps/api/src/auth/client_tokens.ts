import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull, lt, or } from "drizzle-orm";

import type { Database } from "../db";
import { clients } from "../db/schema";

const TOKEN_PREFIX = "sdc_";
const TOKEN_PATTERN = /^sdc_[A-Za-z0-9_-]{43}$/;
const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

function hashClientToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateClientToken(): { token: string; tokenHash: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashClientToken(token) };
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

/** The active client a bearer token belongs to, or null for a malformed, unknown or revoked one. */
export async function clientForToken(db: Database, token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tokenHash, hashClientToken(token)), isNull(clients.revokedAt)))
    .limit(1);
  if (!client) return null;

  const now = new Date();
  const cutoff = new Date(now.getTime() - LAST_SEEN_WRITE_INTERVAL_MS);
  if (!client.lastSeenAt || client.lastSeenAt < cutoff) {
    await db
      .update(clients)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(clients.id, client.id),
          or(isNull(clients.lastSeenAt), lt(clients.lastSeenAt, cutoff)),
        ),
      );
    client.lastSeenAt = now;
  }

  return client;
}
