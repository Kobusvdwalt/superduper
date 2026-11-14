import { SQL } from "bun";
import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";

import * as schema from "./schema";

const relations = defineRelations(schema);

export function createDatabase(url: string, max: number): SQL {
  return new SQL({ url, max });
}

export function createDrizzleDb(client: SQL) {
  return drizzle({ client, relations });
}

export type Database = Omit<ReturnType<typeof createDrizzleDb>, "$client">;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;
