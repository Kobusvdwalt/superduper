import { builder } from "../builder";
import { ClientKind } from "./types";

export const CreateClientInput = builder.inputType("CreateClientInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    kind: t.field({ type: ClientKind, required: true }),
    platform: t.string({ required: false }),
  }),
});
