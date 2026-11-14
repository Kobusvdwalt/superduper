import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { QueryCache, QueryClient, queryOptions } from "@tanstack/react-query";

import { createExecutor, GraphQLRequestError, operationNameOf, type Executor } from "@/lib/graphql";

const executors = new WeakMap<QueryClient, Executor>();

export function createQueryClient(
  options: { execute?: Executor; onUnauthenticated?: () => void } = {},
): QueryClient {
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof GraphQLRequestError && error.code === "UNAUTHENTICATED") {
          options.onUnauthenticated?.();
        }
      },
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  executors.set(client, options.execute ?? createExecutor());
  return client;
}

export function executorOf(queryClient: QueryClient): Executor {
  const execute = executors.get(queryClient);
  if (!execute) throw new Error("QueryClient was not created by createQueryClient.");
  return execute;
}

export function keyFor<TVariables>(
  document: TypedDocumentNode<unknown, TVariables>,
  variables?: TVariables,
) {
  return [operationNameOf(document), variables ?? {}] as const;
}

export function documentQuery<TResult, TVariables>(
  queryClient: QueryClient,
  document: TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables,
) {
  const execute = executorOf(queryClient);
  return queryOptions({
    queryKey: keyFor(document, variables),
    queryFn: ({ signal }) => execute(document, variables, { signal }),
  });
}
