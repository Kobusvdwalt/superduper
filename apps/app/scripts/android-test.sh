#!/bin/sh
# JVM unit tests of the Android health plugin. The Gradle project is the generated one under
# src-tauri/gen/android; its tauri.settings.gradle is written by `tauri android build`.
set -eu
cd "$(dirname "$0")/../src-tauri/gen/android"
if [ ! -f tauri.settings.gradle ]; then
  echo "src-tauri/gen/android/tauri.settings.gradle is missing; run 'bun run android:build' once." >&2
  exit 1
fi
exec ./gradlew -q :tauri-plugin-health:testDebugUnitTest "$@"
