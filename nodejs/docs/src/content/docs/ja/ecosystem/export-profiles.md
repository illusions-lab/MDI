---
title: Export profile
description: validated ExportProfile schema と、各出力形式の現在の対応状況。
---

**前提:** [Getting Started](/ja/guides/getting-started/)。profile は page size、font、margin、indentation などの**表示**を設定し、MDI syntax/意味は変えません。package は `@illusions-lab/mdi-export-profile` です。

## Schema

```json
{"metadata":{"title":"The Last Station","author":"A Writer"},"typesetting":{"writingMode":"horizontal","fontFamily":"Noto Serif JP","textIndentEm":1},"pagination":{"pageSize":"A4","landscape":false,"charactersPerLine":40,"linesPerPage":34,"margins":{"top":25.4,"bottom":25.4,"left":25.4,"right":25.4}},"epub":{"chapterSplitLevel":"h1","coverPath":"cover.png"},"text":{"fullwidthSpaceIndent":true,"indentCount":1}}
```

全 field は optional で、`resolveExportProfile({})` は default を返します。主な validation は、`writingMode` が `horizontal|vertical`、`textIndentEm` が 0–4、`pageSize` が exported `PAGE_DIMENSIONS` key、characters/line が 10–60、lines/page が 10–50、margin が 0–50 mm、chapter split が `h1|h2|h3|none`、text indent が 1–4 です。不正値は clamp/ignore せず field 名を含む `Error` になります。

```bash
mdi build novel.mdi --to pdf --config novel.export.json -o novel.pdf
```

`resolvePrintProfile(profile, sourceWritingMode)` は document writing mode を default にし、vertical では default landscape を `true` にします。

## Format support today

| Setting | PDF | TXT | EPUB / DOCX |
| --- | --- | --- | --- |
| geometry/font/page number | Yes | — | **Pending** |
| front matter metadata/writing mode | Yes | — | Yes（profile からではない） |
| full-width-space indent | Yes | Yes | **Pending** |
| cover/chapter split | — | — | **Pending** |

## 次へ

- [CLI](/ja/bindings/cli/)
- [Rust Core API](/ja/core/rust-api/)
