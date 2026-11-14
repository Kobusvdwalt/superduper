import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { DocumentNode } from "graphql";

import { operationNameOf } from "@/lib/graphql";
import { documentQuery, executorOf, keyFor } from "@/lib/query-client";

export function useGqlQuery<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  options: { variables?: TVariables; enabled?: boolean; keepPrevious?: boolean } = {},
) {
  const queryClient = useQueryClient();
  return useQuery({
    ...documentQuery(queryClient, document, options.variables),
    enabled: options.enabled,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

/** Cursor pagination: `after` is supplied per page; `nextCursor` reads it from a result. */
export function useGqlPages<TResult, TVariables extends { after?: string | null }>(
  document: TypedDocumentNode<TResult, TVariables>,
  options: {
    variables: Omit<TVariables, "after">;
    nextCursor: (page: TResult) => string | null | undefined;
  },
) {
  const queryClient = useQueryClient();
  const execute = executorOf(queryClient);
  return useInfiniteQuery({
    queryKey: [...keyFor(document, options.variables as TVariables), "pages"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      execute(document, { ...options.variables, after: pageParam } as TVariables, { signal }),
    getNextPageParam: (page) => options.nextCursor(page) ?? undefined,
  });
}

export function useGqlMutation<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  options: { invalidate?: readonly DocumentNode[] } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => executorOf(queryClient)(document, variables),
    onSuccess: () =>
      Promise.all(
        (options.invalidate ?? []).map((doc) =>
          queryClient.invalidateQueries({ queryKey: [operationNameOf(doc)] }),
        ),
      ),
  });
}
