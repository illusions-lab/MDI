#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <output-directory>" >&2
  exit 64
fi

output_directory="$1"
root_directory="$(cd "$(dirname "$0")/.." && pwd)"
work_directory="$(mktemp -d "${TMPDIR:-/tmp}/mdi-swift-xcframework.XXXXXX")"
trap 'rm -rf "$work_directory"' EXIT

headers_directory="$work_directory/headers"
mkdir -p "$headers_directory" "$output_directory"
cp "$root_directory/swift/Sources/MDICore/include/mdi_core.h" "$headers_directory/mdi_core.h"
printf '%s\n' 'module MDICore { header "mdi_core.h" export * }' > "$headers_directory/module.modulemap"

build_library() {
  local target="$1"
  (
    cd "$root_directory/mdi-core"
    cargo build --locked --release --target "$target"
  )
}

for target in \
  aarch64-apple-darwin \
  x86_64-apple-darwin \
  aarch64-apple-ios \
  aarch64-apple-ios-sim \
  x86_64-apple-ios; do
  build_library "$target"
done

macos_library="$work_directory/libmdi_core-macos.a"
ios_simulator_library="$work_directory/libmdi_core-ios-simulator.a"
lipo -create \
  "$root_directory/mdi-core/target/aarch64-apple-darwin/release/libmdi_core.a" \
  "$root_directory/mdi-core/target/x86_64-apple-darwin/release/libmdi_core.a" \
  -output "$macos_library"
lipo -create \
  "$root_directory/mdi-core/target/aarch64-apple-ios-sim/release/libmdi_core.a" \
  "$root_directory/mdi-core/target/x86_64-apple-ios/release/libmdi_core.a" \
  -output "$ios_simulator_library"

xcodebuild -create-xcframework \
  -library "$macos_library" -headers "$headers_directory" \
  -library "$root_directory/mdi-core/target/aarch64-apple-ios/release/libmdi_core.a" -headers "$headers_directory" \
  -library "$ios_simulator_library" -headers "$headers_directory" \
  -output "$output_directory/MDICore.xcframework"
