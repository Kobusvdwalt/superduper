#!/bin/sh
set -eu
(cd ../.. && bun install --frozen-lockfile)

exec bun run check
