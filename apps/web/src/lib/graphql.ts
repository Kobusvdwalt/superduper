import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { Kind, print, type DocumentNode, type GraphQLFormattedError } from "graphql";
import { z } from "zod";

const GRAPHQL_URL = "/api/graphql";

export type Executor = <TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables | undefined,
  options?: { signal?: AbortSignal },
) => Promise<TResult>;

const responseBodySchema = z.object({
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  errors: z
    .array(
      z.looseObject({
        message: z.string(),
        path: z.array(z.union([z.string(), z.number().int()])).optional(),
        extensions: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

export class GraphQLRequestError extends Error {
  readonly errors: readonly GraphQLFormattedError[];
  readonly status: number;

  constructor(options: { errors: readonly GraphQLFormattedError[]; status: number }) {
    super(
      options.errors[0]?.message ??
        (options.status >= 200 && options.status < 300
          ? "Invalid GraphQL response."
          : `Request failed with status ${options.status}`),
    );
    this.name = "GraphQLRequestError";
    this.errors = options.errors;
    this.status = options.status;
  }

  /** The `extensions.code` of the first error, e.g. `UNAUTHENTICATED`. */
  get code(): string | undefined {
    const code = this.errors[0]?.extensions?.code;
    return typeof code === "string" ? code : undefined;
  }
}

export function operationNameOf(document: DocumentNode): string {
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION && definition.name) {
      return definition.name.value;
    }
  }
  throw new Error("GraphQL operations must be named.");
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function createExecutor(
  url: string = GRAPHQL_URL,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Executor {
  return async (document, variables, options) => {
    const response = await fetchImpl(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: print(document),
        variables,
        operationName: operationNameOf(document),
      }),
      signal: options?.signal,
    });

    const body = parseBody(await response.text());
    if (!response.ok || !body?.data || body.errors?.length) {
      throw new GraphQLRequestError({ errors: body?.errors ?? [], status: response.status });
    }
    return body.data as never;
  };
}

function parseBody(text: string) {
  try {
    return responseBodySchema.safeParse(JSON.parse(text)).data;
  } catch {
    return undefined;
  }
}
