import { builder } from "./builder";

type Namespace = Record<string, never>;

export function namespace(name: string, label: string) {
  const query = builder.objectRef<Namespace>(`${name}Query`).implement({
    description: `Reads in the ${label} domain.`,
    fields: () => ({}),
  });
  const mutation = builder.objectRef<Namespace>(`${name}Mutation`).implement({
    description: `Writes in the ${label} domain.`,
    fields: () => ({}),
  });

  builder.queryField(label, (t) => t.field({ type: query, resolve: () => ({}) }));
  builder.mutationField(label, (t) => t.field({ type: mutation, resolve: () => ({}) }));

  return { query, mutation };
}
