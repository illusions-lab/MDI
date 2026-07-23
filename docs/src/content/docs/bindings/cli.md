---
title: CLI
description: "Export a .mdi file from the shell, with one shared profile for EPUB, DOCX, PDF, and text."
---

**Prerequisites:** [Getting Started](/guides/getting-started/) and [Export profiles](/ecosystem/export-profiles/).

## Install and build

```bash
npm install --global @illusions-lab/mdi-cli
mdi build novel.mdi --to epub --config novel.export.json -o dist/novel.epub
```

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

`<input.mdi>` is UTF-8. `--to` is required; `-o` overrides the derived output path and cannot be used with `txt-all`; `--config` points to an [export profile](/ecosystem/export-profiles/) JSON file. Success prints `Written <path>` and exits `0`. Any argument, input, profile, renderer, or output failure writes one message to stderr and exits `1`.

## Which output you get

| `--to` | Default | Renderer and profile behavior |
| --- | --- | --- |
| `html` | `novel.html` | Rust semantic standalone HTML; no page profile is applied. |
| `pdf` | `novel.pdf` | Rust HTML plus local Chromium; consumes the print profile. |
| `epub` | `novel.epub` | Baseline Rust EPUB without `--config`; configured profile export with metadata, typography, chapter split, and optional cover with `--config`. |
| `docx` | `novel.docx` | Baseline Rust DOCX without `--config`; configured profile export with metadata, page setup, typography, and numbering with `--config`. |
| `txt` / `txt-ruby` / `narou` / `kakuyomu` / `aozora` | matching `.txt` suffix | Rust text convention; profile controls indentation. `aozora` is Shift_JIS + CRLF and rejects characters outside that official repertoire instead of writing `?`. |
| `txt-all` | five text files | Writes every text flavor and rejects `-o`. |

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

Semantic MDI parsing and source-span diagnostics remain Rust-owned. Profile values are publication policy: EPUB/DOCX adapters use them to package the parsed IR, while PDF geometry and Chromium layout are host concerns. This keeps application UI preferences and machine-specific browser behavior out of the parser.

## PDF and DOCX limits

PDF requires a Chromium-family browser through `@illusions-lab/mdi-to-pdf`; Chromium receives Rust-rendered HTML, never `.mdi` syntax. It applies paper size, orientation, margins, vertical writing, fonts, type/line grid, indentation, and page numbering. Use [Rendering model](/core/rendering/#the-chromiumpdf-boundary) for the host boundary.

Configured DOCX supports the same practical page, type, and numbering controls, but OOXML cannot promise pixel-identical browser composition. Ruby, tate-chu-yoko, no-break/kern, and forced blank paragraphs are represented using DOCX's available runs, directions, and paragraph constructs; validate in the Word-compatible reader you ship against. For parser diagnostics in an editor, call `@illusions-lab/mdi`'s `parse()` before invoking the CLI.
