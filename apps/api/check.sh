#!/bin/sh
set -eu
cd ../..
bun install --frozen-lockfile
# Root files and the chart tests, which this app's sources include.
bun run check:root
cd apps/api

exec bun run check
