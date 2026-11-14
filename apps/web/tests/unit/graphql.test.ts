import { describe, expect, mock, test } from "bun:test";

import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";

import { createExecutor, GraphQLRequestError } from "@/lib/graphql";
import { createQueryClient, documentQuery } from "@/lib/query-client";

const Me: TypedDocumentNode<
  { identity: { me: { user: { email: string } } } },
  Record<string, never>
> = parse("query TestMe { identity { me { user { email } } } }");

const respond = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("graphql transport", () => {
  test("posts the named operation with cookies and returns data", async () => {
    const fetchImpl = mock(
      respond(200, { data: { identity: { me: { user: { email: "a@b" } } } } }),
    );
    const execute = createExecutor("/api/graphql", fetchImpl);
    const data = await execute(Me, undefined);
    expect(data.identity.me.user.email).toBe("a@b");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/graphql");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toMatchObject({ operationName: "TestMe" });
  });

  test("GraphQL errors become GraphQLRequestError with the code", async () => {
    const execute = createExecutor(
      "/api/graphql",
      respond(200, {
        data: null,
        errors: [{ message: "Sign in", extensions: { code: "UNAUTHENTICATED" } }],
      }),
    );
    const error = await execute(Me, undefined).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GraphQLRequestError);
    expect((error as GraphQLRequestError).code).toBe("UNAUTHENTICATED");
    expect((error as GraphQLRequestError).message).toBe("Sign in");
  });

  test("a non-JSON failure keeps the HTTP status", async () => {
    const execute = createExecutor("/api/graphql", () =>
      Promise.resolve(new Response("Bad gateway", { status: 502 })),
    );
    const error = await execute(Me, undefined).catch((caught: unknown) => caught);
    expect((error as Error).message).toBe("Request failed with status 502");
  });

  test("the query client reports UNAUTHENTICATED query failures", async () => {
    const onUnauthenticated = mock(() => {});
    const client = createQueryClient({
      execute: () =>
        Promise.reject(
          new GraphQLRequestError({
            errors: [{ message: "x", extensions: { code: "UNAUTHENTICATED" } }],
            status: 200,
          }),
        ),
      onUnauthenticated,
    });
    await client.fetchQuery(documentQuery(client, Me)).catch(() => {});
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
