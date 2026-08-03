---
title: CLI
description: "Export a .mdi file from the shell, with one shared profile for EPUB, DOCX, PDF, and text."
---

**Prerequisites:** [Getting Started](/guides/getting-started/) and [Export profiles](/ecosystem/export-profiles/).

## Install and build

```bash
npm install --global @illusions-lab/mdi-cli
mdi novel.mdi
mdi build novel.mdi --to epub --config novel.export.json -o dist/novel.epub
mdi check novel.mdi
mdi update --check
```

```text
mdi <input.mdi> [--to <format>] [--config export.json] [-o <output>]
mdi build <input.mdi> [--to <format>] [--config export.json] [-o <output>]
mdi check <input.mdi>
mdi update [--check] [--yes]
```

`<input.mdi>` is UTF-8. The shorthand command defaults to HTML, so
`mdi novel.mdi` writes `novel.html`. `build` remains compatible with the
explicit form; its default is also HTML. `--to` selects one of `html`, `json`,
`pdf`, `epub`, `docx`, `txt`, `txt-ruby`, `narou`, `kakuyomu`, `aozora`,
`note`, or `txt-all`. If `--to` is omitted, a recognized `-o` extension selects
the format (`.html`, `.json`, `.pdf`, `.epub`, `.docx`, or `.txt`). An explicit
format that conflicts with the output extension is rejected. `-o` overrides the
derived output path and cannot be used with `txt-all`; `--config` points to an
[export profile](/ecosystem/export-profiles/) JSON file. Success prints
`Written <path>` and exits `0`. Any argument, input, profile, renderer, or
output failure writes one message to stderr and exits `1`.

`mdi --version`, `mdi --help`, and `mdi -h` show the installed version or full
command reference. `mdi check` parses the document and prints source-backed
diagnostics. Warnings still exit `0`; an error diagnostic exits `1`.

`mdi update --check` reports the installed and npm registry versions without
installing anything. `mdi update` asks `Proceed? [y/N]` before running the
global npm install, while `mdi update --yes` is intended for explicitly
authorized automation. Non-interactive sessions never install implicitly and
print the install command instead. Normal CLI invocations perform a
best-effort, once-per-day cached registry check in the background; failures do
not change the command result and update notices go to stderr, so JSON and
other stdout pipelines remain valid. Set `MDI_NO_UPDATE_CHECK=1` to disable
the background check.

## Which output you get

| `--to` | Default | Renderer and profile behavior |
| --- | --- | --- |
| `json` | `novel.json` | Pretty-printed versioned MDI IR envelope, including parser diagnostics. |
| `html` | `novel.html` | Rust semantic standalone HTML; no page profile is applied. |
| `pdf` | `novel.pdf` | Rust HTML plus local Chromium; consumes the print profile. |
| `epub` | `novel.epub` | Baseline Rust EPUB without `--config`; configured profile export with metadata, typography, chapter split, and optional cover with `--config`. |
| `docx` | `novel.docx` | Baseline Rust DOCX without `--config`; configured profile export with metadata, page setup, typography, and numbering with `--config`. |
| `txt` / `txt-ruby` / `narou` / `kakuyomu` / `aozora` / `note` | matching `.txt` suffix | Rust text convention; profile controls indentation. `note` is UTF-8 editor input; see [note export](/ecosystem/note/). `aozora` is Shift_JIS + CRLF and rejects characters outside that official repertoire instead of writing `?`. |
| `txt-all` | six text files | Writes every text flavor and rejects `-o`. |

The CLI reads `epub.coverPath` relative to the profile file. It must name a PNG or JPEG; the bytes are included in the EPUB only, never sent to the parser. `--config` is no longer silently ignored for EPUB or DOCX.

Without `--config`, the CLI chooses its built-in layout from front matter: `writing-mode: vertical` uses `japanese-publisher`'s A4-landscape, right-bound 40×30 novel-manuscript grid; every other document uses `word`'s flowing A4 layout. Only a supplied `--config` must explicitly contain `layout.system`.

## A useful profile

```json
{
  "layout": { "system": "japanese-publisher" },
  "metadata": { "title": "雨の東京", "author": "Illusions", "language": "ja" },
  "typesetting": { "writingMode": "vertical", "fontFamily": "Yu Mincho", "fontSize": 10, "textIndentEm": 1 },
  "pagination": {
    "pageSize": "A4", "landscape": true, "gridMode": "strict",
    "pageNumbers": { "enabled": true, "position": "bottom-center", "format": "simple" }
  },
  "epub": { "chapterSplitLevel": "h1", "coverPath": "cover.png" }
}
```

When supplied, `--config` must contain `layout.system`; a profile without it is rejected. `"japanese-publisher"` is the book system: horizontal text defaults to a mirrored, left-bound `Shirokuban`/10 pt Mincho 27×26 strict grid; vertical text defaults to the mirrored, right-bound A4-landscape novel-manuscript 40×30 strict grid. `"word"` is a separate flowing system: A4, 25.4 mm margins on all four sides, no mirroring, and `gridMode: "typographic"`; it rejects strict grids.

Rust owns semantic parsing, source-span diagnostics, profile validation, the paper catalogue, and configured EPUB/DOCX generation. For PDF it also prepares the print HTML and geometry; the host supplies the machine-specific Chromium process. Application UI preferences stay outside both layers.

## PDF and DOCX limits

PDF requires a Chromium-family browser through `@illusions-lab/mdi-to-pdf`; Chromium receives Rust-rendered HTML, never `.mdi` syntax. It applies paper size, orientation, margins, vertical writing, fonts, type/line grid, indentation, and page numbering. Use [Rendering model](/core/rendering/#the-chromiumpdf-boundary) for the host boundary.

Configured DOCX supports the same practical page, type, and numbering controls, but OOXML cannot promise pixel-identical browser composition. Ruby, tate-chu-yoko, no-break/kern, and forced blank paragraphs are represented using DOCX's available runs, directions, and paragraph constructs; validate in the Word-compatible reader you ship against. For parser diagnostics in an editor, call `@illusions-lab/mdi`'s `parse()` before invoking the CLI.
