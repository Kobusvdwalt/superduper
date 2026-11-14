import { z } from "zod";

const emptyAsUnset = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const str = z.preprocess(emptyAsUnset, z.string().trim().optional());
const strOr = (fallback: string) => z.preprocess(emptyAsUnset, z.string().default(fallback));
const num = (fallback: number) =>
  z.preprocess(emptyAsUnset, z.coerce.number().int().positive().default(fallback));
const csv = z.preprocess(
  emptyAsUnset,
  z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
);

const envSchema = z.object({
  LOG_LEVEL: z.preprocess(emptyAsUnset, z.enum(["debug", "info", "error"]).default("info")),
  API_PORT: z.preprocess(emptyAsUnset, z.coerce.number().int().min(0).max(65535).default(4400)),

  DATABASE_URL: strOr("postgres://superduper:superduper@localhost:54400/superduper"),
  DATABASE_POOL_MAX: num(10),

  BETTER_AUTH_SECRET: z.preprocess(emptyAsUnset, z.string().min(32).optional()),
  BETTER_AUTH_URL: z.preprocess(emptyAsUnset, z.url().default("http://localhost:4400")),
  AUTH_TRUSTED_ORIGINS: csv,
  OWNER_EMAIL: z.preprocess(emptyAsUnset, z.email().toLowerCase().optional()),

  OWNER_PASSWORD: str,
  SEED_API_URL: z.preprocess(emptyAsUnset, z.url().default("http://localhost:4400")),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);

export const env = parsed.data;

export function requireEnv<K extends keyof Env>(names: K[]): { [P in K]: NonNullable<Env[P]> } {
  const missing = names.filter((name) => env[name] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Invalid environment:\n${missing.map((name) => `✖ ${name} is required`).join("\n")}`,
    );
  }
  return env as { [P in K]: NonNullable<Env[P]> };
}
