# Production image. The build context is the repository root:
# docker build -f apps/web/Dockerfile . Dockerfile.dockerignore applies.
# Serves the static build on port 3000 with an SPA fallback. `/api` is not handled here; the
# ingress routes it to the API.
FROM oven/bun:1.4.4 AS build
WORKDIR /repo
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/web/package.json apps/web/
RUN bun install --filter @superduper/web
COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN bun run build && bun run build:server

FROM oven/bun:1.4.4-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /repo/apps/web/dist ./dist
COPY --from=build /repo/apps/web/server-dist/index.js ./server.js
USER 1000:1000
EXPOSE 3000
CMD ["bun", "run", "server.js"]
