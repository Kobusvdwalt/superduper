# syntax=docker/dockerfile:1
# Production image. The build context is the repository root, because the Bun workspace has
# one lockfile: docker build -f apps/api/Dockerfile .

FROM oven/bun:1.4.4 AS deps
WORKDIR /repo
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
RUN bun install --filter @superduper/api --production

FROM oven/bun:1.4.4-slim AS runtime
WORKDIR /repo/apps/api
ENV NODE_ENV=production
ENV API_PORT=4400
COPY --from=deps /repo/node_modules /repo/node_modules
COPY --from=deps /repo/apps/api/node_modules ./node_modules
COPY package.json tsconfig.base.json /repo/
COPY apps/api/package.json apps/api/tsconfig.json ./
COPY apps/api/drizzle ./drizzle
COPY apps/api/src ./src
EXPOSE 4400
USER bun
HEALTHCHECK CMD bun -e "fetch('http://localhost:${API_PORT}/api/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["bun", "run", "src/index.ts"]
