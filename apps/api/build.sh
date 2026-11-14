#!/bin/sh
set -eu
docker build -f Dockerfile -t "$IMAGE" ../..
