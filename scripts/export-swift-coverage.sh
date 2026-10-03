#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <lcov-output>" >&2
  exit 64
fi

coverage_json="$(swift test --show-codecov-path)"
test_binary="$(find .build -type f -path '*IllusionMarkdownPackageTests.xctest/Contents/MacOS/IllusionMarkdownPackageTests' -print -quit)"
profile_data="$(dirname "$coverage_json")/default.profdata"

[[ -f "$coverage_json" ]]
[[ -n "$test_binary" && -f "$test_binary" ]]
[[ -f "$profile_data" ]]

coverage_percent="$(jq -r '
  [ .data[].files[]
    | select(.filename | endswith("/swift/Sources/MDI/MDI.swift"))
    | .summary.lines
    | if .count > 0 then (.covered / .count * 100) else error("MDI source has no coverable lines") end
  ] | if length == 1 then .[0] else error("expected exactly one MDI source coverage record") end
' "$coverage_json")"

awk -v coverage="$coverage_percent" 'BEGIN {
  minimum = 95
  printf "Swift MDI line coverage: %.2f%% (required: %.2f%%)\n", coverage, minimum
  exit !(coverage >= minimum)
}'

xcrun llvm-cov export "$test_binary" \
  -instr-profile="$profile_data" \
  -format=lcov > "$1"
