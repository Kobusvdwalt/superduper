import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const AUTH_URL = "/api/auth";

const sessionSchema = z
  .object({
    user: z.object({ id: z.string(), email: z.string(), name: z.string() }),
    session: z.object({ id: z.string(), expiresAt: z.string() }),
  })
  .nullable();

class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const response = await fetch(`${AUTH_URL}/${path}`, { credentials: "include", ...init, headers });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = z.object({ message: z.string() }).safeParse(body).data?.message;
    throw new AuthError(
      message ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }
  return body;
}

export const sessionQuery = queryOptions({
  queryKey: ["auth", "session"] as const,
  queryFn: async () => sessionSchema.parse(await call("get-session")),
  staleTime: 5 * 60_000,
});

export async function signIn(input: { email: string; password: string }) {
  await call("sign-in/email", { method: "POST", body: JSON.stringify(input) });
}

/** The API accepts only the configured owner email. */
export async function signUp(input: { name: string; email: string; password: string }) {
  await call("sign-up/email", { method: "POST", body: JSON.stringify(input) });
}

export async function signOut() {
  await call("sign-out", { method: "POST", body: "{}" });
}
