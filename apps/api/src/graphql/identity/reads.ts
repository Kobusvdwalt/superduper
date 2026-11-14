import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../../db";
import { clients, users } from "../../db/schema";

export async function findUser(db: Database, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export function listClients(db: Database, userId: string) {
  return db
    .select()
    .from(clients)
    .where(eq(clients.userId, userId))
    .orderBy(desc(clients.createdAt));
}

export async function findClient(db: Database, userId: string, clientId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.id, clientId)))
    .limit(1);
  return client ?? null;
}
