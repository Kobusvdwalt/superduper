# Super Duper

A personal life-history API: health, finance, commerce, movement and work data pushed by
your own devices and connectors into one GraphQL API. Every record is stored complete and
unmodified, with a typed model on top that is pleasant to query.

Built for one person running their own instance.

## Status

| Domain   | State                                                                   |
| -------- | ----------------------------------------------------------------------- |
| Health   | Working: all Android Health Connect record types, synced from the phone |
| Finance  | Planned                                                                 |
| Commerce | Planned                                                                 |
| Movement | Planned                                                                 |
| Work     | Planned                                                                 |

## What is in here

| Path        | What                                                              |
| ----------- | ----------------------------------------------------------------- |
| `apps/api`  | The GraphQL API: Bun, Elysia, GraphQL Yoga, Pothos, Postgres      |
| `apps/web`  | The web app: Vite, React, TanStack Router and Query               |
| `apps/app`  | A Tauri 2 shell for desktop and Android, with native sync plugins |
| `contracts` | Synthetic payload fixtures shared by clients and the API          |
| `docs`      | The health sync contract and the app shell contract               |

## Run it locally

You need Docker and [Bun](https://bun.sh).

```bash
docker compose up --build   # Postgres, the API on :4400, the web app on :4401
bun install
bun run dev:seed            # optional: creates the owner and four weeks of synthetic data
```

Open <http://localhost:4401> and sign in with `OWNER_EMAIL` and `OWNER_PASSWORD` from
[default.env](default.env). Without the seed, choose "Create the owner account" and use
that email address. The GraphQL explorer is at <http://localhost:4401/api/graphql>.

The values in `default.env` are for local development only. Put your own in `.env`.

## Working on it

[AGENTS.md](AGENTS.md) describes the architecture and conventions.
[docs/health-sync-contract.md](docs/health-sync-contract.md) is the contract between
clients and the API for health data. Run `bun run check` in a package before opening a
pull request.

## Security

Report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
