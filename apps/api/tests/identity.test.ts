import { beforeAll, describe, expect, test } from "bun:test";

import { OWNER, useTestApp } from "./_hooks/app";

const app = useTestApp();

const ME = `{ identity { me { user { email } client { id name kind platform } } } }`;
const CLIENTS = `{ identity { clients { id name revokedAt lastSeenAt } } }`;
const REVOKE = `mutation($id: UUID!) { identity { revokeClient(id: $id) { id revokedAt } } }`;

describe("identity", () => {
  let cookie: string;

  beforeAll(async () => {
    expect((await app.signUp()).status).toBe(200);
    cookie = await app.signIn();
  });

  test("liveness answers without credentials", async () => {
    const response = await app.request("/api/healthz");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("only the owner may sign up", async () => {
    expect((await app.signUp("intruder@example.com")).status).toBe(403);
    expect((await app.signUp()).status).not.toBe(200);
  });

  test("a session reads me without a client", async () => {
    const result = await app.execute(ME, { cookie });
    expect(result.errors).toEqual([]);
    expect(result.data.identity.me).toEqual({ user: { email: OWNER.email }, client: null });
  });

  test("anonymous calls are UNAUTHENTICATED", async () => {
    expect((await app.execute(ME)).code).toBe("UNAUTHENTICATED");
    expect((await app.execute(ME, { token: "sdc_not-a-real-token" })).code).toBe("UNAUTHENTICATED");
  });

  test("a created client authenticates with its token and is listed", async () => {
    const { id, token } = await app.createClient(cookie, "Pixel");
    expect(token).toMatch(/^sdc_[A-Za-z0-9_-]{43}$/);

    const me = await app.execute(ME, { token });
    expect(me.data.identity.me.client).toEqual({
      id,
      name: "Pixel",
      kind: "DEVICE",
      platform: "android",
    });

    const listed = await app.execute(CLIENTS, { token });
    const client = listed.data.identity.clients.find((c: { id: string }) => c.id === id);
    expect(client.lastSeenAt).not.toBeNull();
  });

  test("clients cannot create or revoke clients", async () => {
    const { id, token } = await app.createClient(cookie);
    const created = await app.execute(
      `mutation { identity { createClient(input: { name: "x", kind: CONNECTOR }) { token } } }`,
      { token },
    );
    expect(created.code).toBe("FORBIDDEN");
    expect((await app.execute(REVOKE, { token, variables: { id } })).code).toBe("FORBIDDEN");
  });

  test("a revoked token stops working, even with a session cookie alongside", async () => {
    const { id, token } = await app.createClient(cookie);
    const revoked = await app.execute(REVOKE, { cookie, variables: { id } });
    expect(revoked.data.identity.revokeClient.revokedAt).not.toBeNull();

    expect((await app.execute(ME, { token })).code).toBe("UNAUTHENTICATED");
    expect((await app.execute(ME, { token, cookie })).code).toBe("UNAUTHENTICATED");
  });

  test("revoking an unknown client is NOT_FOUND", async () => {
    const result = await app.execute(REVOKE, {
      cookie,
      variables: { id: "01900000-0000-7000-8000-000000000000" },
    });
    expect(result.code).toBe("NOT_FOUND");
  });

  test("client names are validated", async () => {
    const result = await app.execute(
      `mutation { identity { createClient(input: { name: "  ", kind: DEVICE }) { token } } }`,
      { cookie },
    );
    expect(result.code).toBe("BAD_USER_INPUT");
  });
});
