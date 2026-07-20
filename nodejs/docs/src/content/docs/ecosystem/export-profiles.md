---
title: Export profiles
description: The real, validated ExportProfile schema — every field, its default, and which output formats currently honor it.
---

**Prerequisites:** [Getting Started](/guides/getting-started/).

An export profile configures **presentation** — page size, fonts, margins, indentation, page numbers — for a specific output. It never changes MDI syntax or meaning; the same source with two different profiles produces two different-looking PDFs of the *same document*. The package is `@illusions-lab/mdi-export-profile`; `resolveExportProfile` validates every field and throws a descriptive `Error` rather than silently accepting malformed layout data (see below).

## The schema

```json
{
  "metadata": {
    "title": "The Last Station",
    "author": "A Writer",
    "publisher": "Example Press",
    "identifier": "isbn:9780000000000"
  },
  "typesetting": {
    "writingMode": "horizontal",
    "fontFamily": "Noto Serif JP",
    "textIndentEm": 1,
    "fullwidthSpaceIndent": false
  },
  "pagination": {
    "pageSize": "A4",
    "landscape": false,
    "charactersPerLine": 40,
    "linesPerPage": 34,
    "margins": { "top": 25.4, "bottom": 25.4, "left": 25.4, "right": 25.4 },
    "pageNumbers": { "enabled": true, "format": "simple", "position": "bottom-center" }
  },
  "epub": { "chapterSplitLevel": "h1", "coverPath": "cover.png" },
  "text": { "fullwidthSpaceIndent": true, "indentCount": 1 }
}
```

Every top-level key and every field is **optional** — `resolveExportProfile({})` returns `DEFAULT_EXPORT_PROFILE` (shown above, minus `metadata`, which defaults to `{}`). Pass only what you want to override.

| Field | Type | Default | Validation |
| --- | --- | --- | --- |
| `metadata.title`/`author`/`publisher`/`identifier`/`language`/`date` | `string` | — | Must be a string if present. |
| `typesetting.writingMode` | `"horizontal" \| "vertical"` | `"horizontal"` | Must be exactly one of the two. |
| `typesetting.fontFamily` | `string` | `"serif"` | Must be a non-empty string; whitespace-only falls back to default. |
| `typesetting.textIndentEm` | `number` | `1` | `0`–`4`. |
| `typesetting.fullwidthSpaceIndent` | `boolean` | `false` | — |
| `pagination.pageSize` | one of `PAGE_SIZES` | `"A4"` | Must be a key of the exported `PAGE_DIMENSIONS` map (ISO A0–A10, JIS/ISO B0–B10, Japanese book sizes like `Bunko`/`Shinsho`/`Tankobon`, North American `Letter`/`Legal`/`Tabloid`, and postcard/photo sizes like `Hagaki`/`L-ban`). |
| `pagination.landscape` | `boolean` | `false` | — |
| `pagination.charactersPerLine` | `number` | `40` | `10`–`60`. |
| `pagination.linesPerPage` | `number` | `34` | `10`–`50`. |
| `pagination.margins.{top,bottom,left,right}` | `number` (mm) | `25.4` each (1 inch) | `0`–`50`. |
| `pagination.pageNumbers.enabled` | `boolean` | `true` | — |
| `pagination.pageNumbers.format` | `"simple" \| "dash" \| "fraction"` | `"simple"` | Must be one of the three. |
| `pagination.pageNumbers.position` | one of the six `*-{left,center,right}` combinations | `"bottom-center"` | Must be one of the six. |
| `epub.chapterSplitLevel` | `"h1" \| "h2" \| "h3" \| "none"` | `"h1"` | Must be one of the four. |
| `epub.coverPath` | `string` (path, resolved relative to the `--config` file) | — | Must be `.jpg`/`.jpeg`/`.png` when used by the CLI. |
| `text.fullwidthSpaceIndent` | `boolean` | `false` | — |
| `text.indentCount` | `number` | `1` | `1`–`4`. |

Any value outside these constraints — an unsupported `pageSize`, a `charactersPerLine` of `5`, a `writingMode` of `"rtl"` — throws a specific `Error` naming the offending field, both from `resolveExportProfile()` directly and from `parseExportProfileJson()` (used by the CLI's `--config`), rather than clamping or ignoring it silently.

## Using it

```bash
mdi build novel.mdi --to pdf --config novel.export.json -o novel.pdf
mdi build novel.mdi --to docx --config novel.export.json
mdi build novel.mdi --to epub --config novel.export.json
mdi build novel.mdi --to txt-ruby --config novel.export.json
```

```ts
import { parseExportProfileJson, resolveExportProfile } from "@illusions-lab/mdi-export-profile";

const profile = parseExportProfileJson(await readFile("novel.export.json", "utf8"));
const resolved = resolveExportProfile(profile); // every field filled in, fully validated
```

`resolvePrintProfile(profile, sourceWritingMode)` is a small convenience wrapper the PDF/print path uses: it lets a document's own front-matter `writing-mode` supply the default writing mode (an explicit profile always wins), and defaults `landscape: true` for vertical writing, since a vertical character grid is more readable on landscape paper.

## Format support today

| Setting | PDF | TXT / `txt-ruby` | EPUB / DOCX |
| --- | --- | --- | --- |
| Page geometry, fonts, page numbers | Yes | — | **Pending** — Rust's `render_epub`/`render_docx` don't read a profile yet |
| Front-matter metadata / writing mode | Yes | — | Yes (read directly from front matter, not from the profile) |
| Full-width-space indent | Yes | Yes (1–4 spaces via `text.indentCount`) | **Pending** |
| Cover image, chapter split level | — | — | **Pending** |

This table will change as [Rust Core API status: not yet implemented](/core/rust-api/#not-yet-implemented) shrinks — check that page for the current, authoritative status before assuming a field applies to a format not listed as supporting it here.

## Next steps

- [Bindings: CLI](/bindings/cli/) — `--config` in context.
- [Rust Core API status](/core/rust-api/) — exactly which renderer functions exist and what they currently accept.
