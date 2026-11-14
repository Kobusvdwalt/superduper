import { Elysia } from "elysia";
import { createYoga } from "graphql-yoga";

import type { Auth } from "../auth/better_auth";
import type { Database } from "../db";
import { createGraphQLContext, type GraphQLContext } from "./context";
import { schema } from "./schema";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function tooLarge(): Response {
  return Response.json(
    {
      errors: [
        {
          message: `The request body exceeds ${MAX_BODY_BYTES} bytes.`,
          extensions: { code: "BAD_USER_INPUT" },
        },
      ],
    },
    { status: 413 },
  );
}

/** Reads the body once to enforce the contract's size limit, also for chunked requests. */
async function limitBody(request: Request): Promise<Request | null> {
  if (request.method !== "POST") return request;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) return null;
  return new Request(request.url, { method: "POST", headers: request.headers, body });
}

export function graphqlRoutes(db: Database, auth: Auth) {
  const yoga = createYoga<Record<string, never>, GraphQLContext>({
    schema,
    graphqlEndpoint: "/api/graphql",
    landingPage: false,
    context: ({ request }) => createGraphQLContext(db, auth, request),
  });

  const handle = async (request: Request) => {
    const limited = await limitBody(request);
    if (!limited) return tooLarge();
    const response = await yoga.fetch(limited, {});
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  return new Elysia({ name: "graphql" })
    .get("/graphql", ({ request }) => handle(request), { parse: "none" })
    .post("/graphql", ({ request }) => handle(request), { parse: "none" });
}
