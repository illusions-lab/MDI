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
    binary_target=".binaryTarget(name: \"MDICore\", path: \"$2\")"
    ;;
  remote)
    if [[ $# -ne 3 ]]; then
      echo "usage: $0 remote <url> <checksum>" >&2
      exit 64
    fi
    binary_target=".binaryTarget(name: \"MDICore\", url: \"$2\", checksum: \"$3\")"
    ;;
  *)
    echo "unknown mode: $mode" >&2
    exit 64
    ;;
esac

cat > "$root_directory/Package.swift" <<EOF
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
