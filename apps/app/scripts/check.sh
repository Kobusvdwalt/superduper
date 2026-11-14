#!/bin/sh
# Rust format, lint and tests for the shell and plugins, then the Android JVM unit tests.
# Set SKIP_ANDROID=1 on machines without the Android SDK.
set -eu
cd "$(dirname "$0")/.."
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace --quiet
if [ "${SKIP_ANDROID:-}" = "1" ]; then
  echo "SKIP_ANDROID=1: Android unit tests not run" >&2
else
  sh scripts/android-test.sh
fi
