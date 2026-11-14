import { beforeAll } from "bun:test";

import { createApp } from "../../src/app";
import type { Database } from "../../src/db";
import { useDatabase } from "./database";

type GraphQLError = { message: string; extensions?: { code?: string } };

type GraphQLResult<T> = {
  status: number;
  data: T | null;
  errors: GraphQLError[];
  code: string | undefined;
};

type Credentials = { token?: string; cookie?: string };

export const OWNER = {
  email: "owner@example.com",
  password: "correct horse battery",
  name: "Owner",
};

export type TestApp = {
  db: Database;
  request: (path: string, init?: RequestInit & Credentials) => Promise<Response>;
  execute: <T = any>(
    query: string,
    options?: Credentials & { variables?: Record<string, unknown> },
  ) => Promise<GraphQLResult<T>>;
  signUp: (email?: string) => Promise<Response>;
  signIn: () => Promise<string>;
  createClient: (cookie: string, name?: string) => Promise<{ id: string; token: string }>;
};

export function useTestApp(): TestApp {
  const database = useDatabase();
  const app = {} as TestApp;

  beforeAll(() => {
    const elysia = createApp(database.db);

    const request: TestApp["request"] = (path, { token, cookie, headers, ...init } = {}) =>
      elysia.handle(
        new Request(new URL(path, "http://localhost:4400"), {
          ...init,
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:4400",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...(headers as Record<string, string> | undefined),
          },
        }),
      );

    const execute: TestApp["execute"] = async (query, { variables, ...credentials } = {}) => {
      const response = await request("/api/graphql", {
        method: "POST",
        body: JSON.stringify({ query, variables }),
        ...credentials,
      });
      const body = (await response.json()) as { data?: any; errors?: GraphQLError[] };
      const errors = body.errors ?? [];
      return {
        status: response.status,
        data: body.data ?? null,
        errors,
        code: errors[0]?.extensions?.code,
      };
    };

    const signUp: TestApp["signUp"] = (email = OWNER.email) =>
      request("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({ email, password: OWNER.password, name: OWNER.name }),
      });

    const signIn: TestApp["signIn"] = async () => {
      const response = await request("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email: OWNER.email, password: OWNER.password }),
      });
      if (response.status !== 200) throw new Error(`Sign-in failed: ${await response.text()}`);
      return response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
    };

    const createClient: TestApp["createClient"] = async (cookie, name = "Test phone") => {
      const result = await execute<{
        identity: { createClient: { client: { id: string }; token: string } };
      }>(
        `mutation($input: CreateClientInput!) {
          identity { createClient(input: $input) { client { id } token } }
        }`,
        { cookie, variables: { input: { name, kind: "DEVICE", platform: "android" } } },
      );
      const created = result.data?.identity.createClient;
      if (!created) throw new Error(`createClient failed: ${JSON.stringify(result.errors)}`);
      return { id: created.client.id, token: created.token };
    };

    Object.assign(app, { db: database.db, request, execute, signUp, signIn, createClient });
  });

  return app;
}
