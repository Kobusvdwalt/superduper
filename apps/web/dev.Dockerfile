# Development image; build context is the repository root (see docker-compose.yml).
FROM oven/bun:1.4.4

WORKDIR /repo

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/web/package.json apps/web/
RUN bun install --filter @superduper/web

COPY apps/web apps/web

WORKDIR /repo/apps/web
EXPOSE 4401
CMD ["bun", "run", "dev"]
