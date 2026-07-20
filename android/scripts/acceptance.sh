#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$repo_root/mdi-core"
# Android does not expose the process-bound Chromium/PDF path. Keep this
# acceptance command focused on the core surface that is bundled into the AAR.
cargo test --locked --lib -- --skip renders_pdf_with_an_available_native_chromium

cd "$repo_root/mdi-android-jni"
cargo test

cd "$repo_root"
./android/scripts/build-native.sh

cd "$repo_root/android"
./scripts/run-gradle.sh :mdi-android:verifyDebugUnitTestCoverage :mdi-android:connectedDebugAndroidTest
