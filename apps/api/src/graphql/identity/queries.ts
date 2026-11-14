import { builder } from "../builder";
import { requireViewer } from "../context";
import { apiError } from "../errors";
import { findUser, listClients } from "./reads";
import { ClientType, Identity, MeType } from "./types";

builder.objectFields(Identity.query, (t) => ({
  me: t.field({
    type: MeType,
    resolve: async (_root, _args, ctx) => {
      const viewer = requireViewer(ctx);
      const user = await findUser(ctx.db, viewer.userId);
      if (!user) throw apiError("UNAUTHENTICATED", "The signed-in user no longer exists.");
      return { user, client: viewer.kind === "client" ? viewer.client : null };
    },
  }),
  clients: t.field({
    type: [ClientType],
    description: "Every client of the caller's user, revoked ones included, newest first.",
    resolve: (_root, _args, ctx) => listClients(ctx.db, requireViewer(ctx).userId),
  }),
}));
