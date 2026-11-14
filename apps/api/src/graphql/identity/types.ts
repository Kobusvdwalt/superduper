import type { clients, users } from "../../db/schema";
import { builder } from "../builder";
import { namespace } from "../namespaces";

export const Identity = namespace("Identity", "identity");

type User = typeof users.$inferSelect;
type Client = typeof clients.$inferSelect;

export const ClientKind = builder.enumType("ClientKind", {
  values: ["DEVICE", "CONNECTOR"] as const,
});

const UserType = builder.objectRef<User>("User").implement({
  fields: (t) => ({
    id: t.expose("id", { type: "UUID" }),
    email: t.exposeString("email"),
    name: t.exposeString("name"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

export const ClientType = builder.objectRef<Client>("Client").implement({
  description: "A device or connector that pushes data with its own token.",
  fields: (t) => ({
    id: t.expose("id", { type: "UUID" }),
    name: t.exposeString("name"),
    kind: t.expose("kind", { type: ClientKind }),
    platform: t.exposeString("platform", { nullable: true, description: "For example `android`." }),
    lastSeenAt: t.expose("lastSeenAt", { type: "DateTime", nullable: true }),
    revokedAt: t.expose("revokedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

export const MeType = builder.objectRef<{ user: User; client: Client | null }>("Me").implement({
  fields: (t) => ({
    user: t.field({ type: UserType, resolve: (me) => me.user }),
    client: t.field({
      type: ClientType,
      nullable: true,
      description: "The calling client; null for a web session.",
      resolve: (me) => me.client,
    }),
  }),
});

export const CreatedClientType = builder
  .objectRef<{ client: Client; token: string }>("CreatedClient")
  .implement({
    fields: (t) => ({
      client: t.field({ type: ClientType, resolve: (created) => created.client }),
      token: t.exposeString("token", {
        description: "The bearer token. It is shown only here and cannot be retrieved later.",
      }),
    }),
  });
