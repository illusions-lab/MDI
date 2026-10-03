#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <swift-smoke-output-directory> <epubcheck-jar-or-executable>" >&2
  exit 64
fi

output_directory="$1"
epubcheck="$2"

if [[ ! -d "$output_directory" ]]; then
  echo "Swift smoke output directory not found: $output_directory" >&2
  exit 66
fi
if [[ ! -f "$epubcheck" ]]; then
  echo "EPUBCheck not found: $epubcheck" >&2
  exit 66
fi
if [[ "$epubcheck" != *.jar && ! -x "$epubcheck" ]]; then
  echo "EPUBCheck is not executable: $epubcheck" >&2
  exit 66
fi

for name in \
  document.html \
  document.txt \
  document.mdi \
  document.epub \
  document.docx \
  document-txt.txt \
  document-txt-ruby.txt \
  document-narou.txt \
  document-kakuyomu.txt \
  document-aozora.txt \
  document-note.txt; do
  if [[ ! -s "$output_directory/$name" ]]; then
    echo "Swift smoke artifact is missing or empty: $name" >&2
    exit 65
  fi
done

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/mdi-swift-consumers.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

# TextEdit's command-line frontend uses Apple's native document importers. This
# opens both the HTML and DOCX outputs rather than merely checking signatures.
textutil -convert txt \
  -output "$temporary_directory/html.txt" \
  "$output_directory/document.html"
textutil -convert txt \
  -output "$temporary_directory/docx.txt" \
  "$output_directory/document.docx"
grep -Fq "Swift package contract" "$temporary_directory/html.txt"
grep -Fq "Swift package contract" "$temporary_directory/docx.txt"

# Plain text and canonical MDI are UTF-8 text contracts. MDI is additionally
# reparsed and checked for canonical idempotence inside MDITests.
iconv -f UTF-8 -t UTF-8 "$output_directory/document.txt" >/dev/null
iconv -f UTF-8 -t UTF-8 "$output_directory/document.mdi" >/dev/null
grep -Fq "東京" "$output_directory/document.txt"
grep -Fq "{東京|とうきょう}" "$output_directory/document.mdi"
for name in \
  document-txt.txt \
  document-txt-ruby.txt \
  document-narou.txt \
  document-kakuyomu.txt \
  document-aozora.txt \
  document-note.txt; do
  iconv -f UTF-8 -t UTF-8 "$output_directory/$name" >/dev/null
done
grep -Fq "{東京|とうきょう}" "$output_directory/document-txt-ruby.txt"
grep -Fq "｜東京《とうきょう》" "$output_directory/document-narou.txt"
grep -Fq "｜東京《とうきょう》" "$output_directory/document-kakuyomu.txt"
grep -Fq "｜東京《とうきょう》" "$output_directory/document-aozora.txt"
grep -Fq "｜東京《とうきょう》" "$output_directory/document-note.txt"
grep -Fq "## Swift package contract" "$output_directory/document-note.txt"

# Exercise the ZIP readers before the format-specific validators/importers so
# corrupt central directories fail with a direct diagnostic.
unzip -tqq "$output_directory/document.epub"
unzip -tqq "$output_directory/document.docx"

# EPUBCheck is the official EPUB conformance checker maintained by the W3C.
if [[ "$epubcheck" == *.jar ]]; then
  java -jar "$epubcheck" "$output_directory/document.epub"
else
  "$epubcheck" "$output_directory/document.epub"
fi

echo "Swift package format smoke passed: HTML, TXT (all 6 conventions), MDI, EPUB, DOCX"
