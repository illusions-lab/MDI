---
title: Export profiles
description: The real, validated ExportProfile schema — every field, its default, and which output formats currently honor it.
---

**Prerequisites:** [Getting Started](/guides/getting-started/).

An export profile configures **presentation** — page size, fonts, margins, indentation, page numbers — for a specific output. It never changes MDI syntax or meaning; the same source with two different profiles produces two different-looking PDFs of the *same document*. The package is `@illusions-lab/mdi-export-profile`; its JavaScript functions pass validation and default resolution to `mdi-core`, then return a friendly typed result or a descriptive `Error`.

## The schema

```json
{
  "layout": { "system": "word" },
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

`resolveExportProfile({})` is available for internal/default resolution, but every configured CLI or `@illusions-lab/mdi` export must state `layout.system`. Choose one contract: `"japanese-publisher"` for a strict, mirrored Japanese book grid, or `"word"` for flowing Word-style pages. They are intentionally not mixed.

| Field | Type | Default | Validation |
| --- | --- | --- | --- |
| `layout.system` | `"japanese-publisher" \| "word"` | publisher for internal resolution; **required at configured-export boundaries** | Selects the complete layout contract. |
| `layout.marginMode` / `bindingSide` / `gutter` | `"single"\|"mirror"` / `"left"\|"right"` / mm | publisher: mirror, direction-dependent binding, 0 mm | `word` has no gutter and defaults to single margins. |
| `metadata.title`/`author`/`publisher`/`identifier`/`language`/`date` | `string` | — | Must be a string if present. |
| `typesetting.writingMode` | `"horizontal" \| "vertical"` | `"horizontal"` | Must be exactly one of the two. |
| `typesetting.fontFamily` | `string` | Mincho fallback stack | Must be a non-empty string; whitespace-only falls back to default. |
| `typesetting.textIndentEm` | `number` | `1` | `0`–`4`. |
| `typesetting.fullwidthSpaceIndent` | `boolean` | `false` | — |
| `pagination.pageSize` | one of `PAGE_SIZES` | publisher: `"Shirokuban"`; word: `"A4"` | Must be one of the 67 Rust-owned catalogue keys exposed through `PAGE_DIMENSIONS`. |
| `pagination.landscape` | `boolean` | `false` | — |
| `pagination.charactersPerLine` / `linesPerPage` | `number` | publisher horizontal: `27`×`26`; vertical: `40`×`30`; word: informational | `10`–`400`. |
| `pagination.gridMode` | `"strict" \| "typographic"` | publisher: strict; word: typographic | `word` rejects strict; strict rejects explicit line spacing. |
| `pagination.margins.{top,bottom,left,right}` | `number` (mm) | publisher: 16.5/18/18/15.5; word: `25.4` each | Must leave printable width and height. |
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

`resolvePrintProfile(profile, sourceWritingMode)` is the PDF/print convenience wrapper: a document's front matter supplies the writing-mode default, while an explicit profile wins. It does not silently switch paper orientation.

## Format support today

| Setting | PDF | TXT / `txt-ruby` | EPUB / DOCX |
| --- | --- | --- | --- |
| Page geometry, fonts, page numbers | Yes | — | DOCX: Yes; EPUB uses typography but is reflowable |
| Metadata / writing mode | Yes | — | EPUB / DOCX: Yes |
| Full-width-space indent | Yes | Yes (1–4 spaces via `text.indentCount`) | EPUB / DOCX: Yes |
| Cover image, chapter split level | — | — | EPUB: Yes |

`mdi-core` owns the defaults, validation rules, physical paper dimensions,
and renderer-facing profile. The JavaScript package adds TypeScript types and
Japanese UI labels without copying the layout table. EPUB cannot promise fixed
physical pages because it is reflowable.

## Next steps

- [Bindings: CLI](/bindings/cli/) — `--config` in context.
- [Rust Core API status](/core/rust-api/) — exactly which renderer functions exist and what they currently accept.
