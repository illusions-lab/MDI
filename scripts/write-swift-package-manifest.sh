#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 local <xcframework-path> | remote <url> <checksum>" >&2
  exit 64
fi

root_directory="$(cd "$(dirname "$0")/.." && pwd)"
mode="$1"

case "$mode" in
  local)
    if [[ $# -ne 2 ]]; then
      echo "usage: $0 local <xcframework-path>" >&2
      exit 64
    fi
    xcframework_path="$2"
    if [[ "$xcframework_path" != /* ]]; then
      xcframework_path="$root_directory/$xcframework_path"
    fi
    if [[ ! -d "$xcframework_path" ]]; then
      echo "XCFramework not found: $2" >&2
      exit 66
    fi
    if [[ "$2" == *'"'* || "$2" == *$'\n'* ]]; then
      echo "XCFramework path cannot contain a quote or newline" >&2
      exit 64
    fi
    binary_target=".binaryTarget(name: \"MDICore\", path: \"$2\")"
    ;;
  remote)
    if [[ $# -ne 3 ]]; then
      echo "usage: $0 remote <url> <checksum>" >&2
      exit 64
    fi
    if [[ "$2" != https://* || "$2" == *'"'* || "$2" == *$'\n'* ]]; then
      echo "remote XCFramework URL must be an HTTPS URL without quotes or newlines" >&2
      exit 64
    fi
    if [[ ! "$3" =~ ^[0-9a-f]{64}$ ]]; then
      echo "checksum must contain exactly 64 lowercase hexadecimal characters" >&2
      exit 64
    fi
    binary_target=".binaryTarget(name: \"MDICore\", url: \"$2\", checksum: \"$3\")"
    ;;
  *)
    echo "unknown mode: $mode" >&2
    exit 64
    ;;
esac

generated_manifest="$(mktemp "$root_directory/.Package.swift.XXXXXX")"
trap 'rm -f "$generated_manifest"' EXIT

cat > "$generated_manifest" <<EOF
// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "IllusionMarkdown",
    platforms: [.macOS(.v13), .iOS(.v15)],
    products: [
        .library(name: "MDI", targets: ["MDI"]),
    ],
    targets: [
        $binary_target,
        .target(name: "MDI", dependencies: ["MDICore"], path: "swift/Sources/MDI"),
        .testTarget(name: "MDITests", dependencies: ["MDI", "MDICore"], path: "swift/Tests/MDITests"),
    ]
)
EOF

chmod 0644 "$generated_manifest"
mv "$generated_manifest" "$root_directory/Package.swift"
trap - EXIT
