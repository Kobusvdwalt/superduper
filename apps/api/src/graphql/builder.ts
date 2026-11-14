import SchemaBuilder from "@pothos/core";
import { DateTimeISOResolver, JSONObjectResolver, UUIDResolver } from "graphql-scalars";

import type { GraphQLContext } from "./context";

export type SchemaTypes = {
  Context: GraphQLContext;
  Scalars: {
    DateTime: { Input: Date; Output: Date | string };
    UUID: { Input: string; Output: string };
    JSON: { Input: Record<string, unknown>; Output: Record<string, unknown> };
  };
  DefaultFieldNullability: false;
};

export type Types = PothosSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

export const builder = new SchemaBuilder<SchemaTypes>({
  defaultFieldNullability: false,
});

builder.addScalarType("DateTime", DateTimeISOResolver);
builder.addScalarType("UUID", UUIDResolver);
builder.addScalarType("JSON", JSONObjectResolver);

builder.queryType({ description: "Read operations, namespaced by domain." });
builder.mutationType({ description: "Write operations, namespaced by domain." });
