#!/usr/bin/env bash
set -euo pipefail

# A wrapper-free bootstrap so this repository can verify Android before it
# chooses to commit Gradle wrapper binaries. CI and contributors get the same
# pinned Gradle version.
gradle_version="8.11.1"
cache_dir="${TMPDIR:-/tmp}/mdi-gradle-${gradle_version}"
gradle_bin="$cache_dir/gradle-${gradle_version}/bin/gradle"

if ! java -version >/dev/null 2>&1; then
    echo "JDK 17+ is required to run the Android build." >&2
    exit 1
fi

if [[ ! -x "$gradle_bin" ]]; then
    mkdir -p "$cache_dir"
    archive="$cache_dir/gradle-${gradle_version}-bin.zip"
    curl --fail --location --retry 3 \
        "https://services.gradle.org/distributions/gradle-${gradle_version}-bin.zip" \
        --output "$archive"
    unzip -q "$archive" -d "$cache_dir"
fi

"$gradle_bin" "$@"
