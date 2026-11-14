# Development image; build context is the repository root (see docker-compose.yml).
FROM oven/bun:1.4.4

WORKDIR /repo

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN bun install --filter @superduper/api

COPY apps/api apps/api
COPY contracts contracts

WORKDIR /repo/apps/api
EXPOSE 4400
CMD ["bun", "run", "dev"]
