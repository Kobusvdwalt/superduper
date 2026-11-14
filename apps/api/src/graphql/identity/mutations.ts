import { and, eq, isNull } from "drizzle-orm";

import { generateClientToken } from "../../auth/client_tokens";
import { clients } from "../../db/schema";
import { builder } from "../builder";
import { requireSession } from "../context";
import { apiError } from "../errors";
import { CreateClientInput } from "./inputs";
import { findClient } from "./reads";
import { ClientType, CreatedClientType, Identity } from "./types";

builder.objectFields(Identity.mutation, (t) => ({
  createClient: t.field({
    type: CreatedClientType,
    description: "Registers a device or connector and returns its token once. Requires a session.",
    args: { input: t.arg({ type: CreateClientInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const viewer = requireSession(ctx);
      const name = input.name.trim();
      if (name.length === 0 || name.length > 100) {
        throw apiError("BAD_USER_INPUT", "name must be 1 to 100 characters.");
      }
      const platform = input.platform?.trim() || null;
      if (platform && platform.length > 50) {
        throw apiError("BAD_USER_INPUT", "platform must be at most 50 characters.");
      }

      const { token, tokenHash } = generateClientToken();
      const [client] = await ctx.db
        .insert(clients)
        .values({ userId: viewer.userId, name, kind: input.kind, platform, tokenHash })
        .returning();
      if (!client) throw new Error("Insert returned no client.");
      return { client, token };
    },
  }),
  revokeClient: t.field({
    type: ClientType,
    description: "Revokes a client's token. Revoking twice keeps the first revocation time.",
    args: { id: t.arg({ type: "UUID", required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const viewer = requireSession(ctx);
      await ctx.db
        .update(clients)
        .set({ revokedAt: new Date() })
        .where(
          and(eq(clients.id, id), eq(clients.userId, viewer.userId), isNull(clients.revokedAt)),
        );
      const client = await findClient(ctx.db, viewer.userId, id);
      if (!client) throw apiError("NOT_FOUND", "No such client.");
      return client;
    },
  }),
}));
