import { mock } from "bun:test";

import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { operationNameOf, type Executor } from "@/lib/graphql";
import { createQueryClient } from "@/lib/query-client";

import { routeTree } from "../../src/routeTree.gen";

const SESSION = {
  user: { id: "u1", email: "owner@example.com", name: "Owner" },
  session: { id: "s1", expiresAt: "2099-01-01T00:00:00.000Z" },
};

type Responses = Record<string, (variables: Record<string, unknown>) => unknown>;

/** Renders the real route tree; GraphQL answers come from `responses` by operation name. */
export function renderApp(
  path: string,
  { signedIn = true, responses = {} }: { signedIn?: boolean; responses?: Responses } = {},
) {
  const calls: { operation: string; variables: Record<string, unknown> }[] = [];
  const execute: Executor = (document, variables) => {
    const operation = operationNameOf(document);
    const vars = (variables ?? {}) as Record<string, unknown>;
    calls.push({ operation, variables: vars });
    const answer = responses[operation];
    if (!answer) return Promise.reject(new Error(`No test response for ${operation}`));
    return Promise.resolve(answer(vars) as never);
  };
  globalThis.fetch = mock((input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/api/auth/get-session")) {
      return Promise.resolve(Response.json(signedIn ? SESSION : null));
    }
    return Promise.resolve(Response.json({}, { status: 404 }));
  }) as unknown as typeof fetch;

  const queryClient = createQueryClient({ execute });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, calls };
}
