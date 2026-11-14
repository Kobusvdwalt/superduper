# Super Duper

A personal life-history API. Clients push data into one GraphQL API, organised by domain:
`health`, `finance`, `commerce`, `movement`, `work`. The goal is to record as much as
possible now, losslessly, and keep a structured model on top that is pleasant to query.

The stack follows `Tiental/vigil-next` (a local checkout is usually at
`/home/kobus/work/vigil-next`; treat it as a read-only reference for versions, config and
patterns). This file lists where Super Duper deliberately differs.

## Layout

Bun workspaces, one lockfile.

| Path        | Package           | What                                                    |
| ----------- | ----------------- | ------------------------------------------------------- |
| `apps/api`  | `@superduper/api` | Elysia + GraphQL Yoga + Pothos, Better Auth, Drizzle     |
| `apps/web`  | `@superduper/web` | Vite + React, TanStack Router/Query, GraphQL codegen     |
| `apps/app`  | `@superduper/app` | Tauri 2 shell (desktop + Android) and its native plugins |
| `contracts` | —                 | Payload fixtures shared by clients and the API           |
| `docs`      | —                 | Contracts and ADRs (`docs/adr/`)                         |

Run `bun run check` in a package before calling work done. It runs typecheck, lint, format
check, dead-code check, schema/codegen freshness and tests.

## Principles

1. **Raw first.** Every pushed record is stored complete and unmodified, with its history.
   Ingestion never fails or drops data because a structured projection could not be built.
2. **Structured second.** Typed tables and typed GraphQL are a projection of the raw
   archive, rebuildable at any time from it.
3. **Clients push.** Devices and connectors are all "clients" with their own revocable
   token. Server-side collectors (bank, grocery) are separate processes that push through
   the same GraphQL API; nothing writes to the database around the API.
4. **Single user, multi-user shaped.** Every row carries `user_id`. No organisations,
   roles or permission system.

## API

- Elysia app; Better Auth at `/api/auth/*`; GraphQL Yoga at `/api/graphql`; liveness at
  `/api/healthz`.
- Code-first schema with Pothos. `schema.graphql` is generated and checked in;
  `schema:check` fails when it is stale. The web codegen reads that file.
- One folder per domain: `src/graphql/<domain>/{types,inputs,queries,mutations,reads}.ts`.
  Reads and writes are namespaced: `query { health { … } }`, `mutation { health { sync } }`.
- Thin layering: resolvers call plain functions that use Drizzle directly. No
  repository/service framework.
- Errors are `GraphQLError` with `extensions.code` (`BAD_USER_INPUT`, `NOT_FOUND`,
  `FORBIDDEN`, `UNAUTHENTICATED`, `CONFLICT`).
- Time series use cursor pagination (`after`, `limit`), not offset paging.
- Configuration is read only through a Zod-validated `src/env.ts`.

## Database

- Postgres 18, Drizzle, one file per table under `apps/api/src/db/schema/`.
- IDs are UUID v7 (`uuidv7()`), timestamps `timestamptz`, `created_at`/`updated_at`.
- `drizzle-kit generate` writes migrations; the API applies them at startup under an
  advisory lock. Tests run against PGlite.
- Table names are prefixed by domain: `health_*`, `finance_*`, …; shared tables are
  unprefixed (`users`, `clients`, `sync_batches`).

## Auth

- Web: Better Auth cookie session. Sign-up is restricted to the configured owner.
- Clients (devices, connectors): `Authorization: Bearer <client token>`. Tokens are opaque,
  shown once, stored hashed, and revocable per client.

## App shell

`apps/app` is a thin Tauri 2 shell that loads the hosted web app. Native capabilities live
in Tauri plugins under `apps/app/plugins/`, never inside generated `gen/` directories.
Background work on Android is native (WorkManager), not webview timers. The web app talks
to the shell only through `apps/web/src/lib/shell.ts`.

## Contracts

Read [docs/health-sync-contract.md](docs/health-sync-contract.md) before touching health
ingestion on either side. Change the contract document, the fixtures in `contracts/` and
both implementations in the same pull request.

## Conventions

- Conventional Commits with a scope: `feat(health): …`, `fix(api): …`.
- Branches: `feat/…`, `fix/…`, `chore/…`, `docs/…`. Work lands through pull requests.
- Comments: delete by default. Keep only what the code cannot say: behaviour forced by a
  dependency or platform (name it), public contract docs, links to an issue or ADR.
- Do not build for cases nobody asked about. Build the simple version and report the
  failure mode. Exempt: validation and authorisation at trust boundaries.
- UI: functional, unstyled-ish shadcn defaults. Visual design happens separately.
- Never commit secrets or personal data. Fixtures are synthetic.
