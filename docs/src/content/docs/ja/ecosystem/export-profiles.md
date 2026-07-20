---
title: Export profile
description: validated ExportProfile schema と、各出力形式の現在の対応状況。
---

**前提:** [Getting Started](/ja/guides/getting-started/)。profile は page size、font、margin、indentation などの**表示**を設定し、MDI syntax/意味は変えません。package は `@illusions-lab/mdi-export-profile` です。

## Schema

```json
{"metadata":{"title":"The Last Station","author":"A Writer","publisher":"Example Press","identifier":"isbn:9780000000000"},"typesetting":{"writingMode":"horizontal","fontFamily":"Noto Serif JP","textIndentEm":1,"fullwidthSpaceIndent":false},"pagination":{"pageSize":"A4","landscape":false,"charactersPerLine":40,"linesPerPage":34,"margins":{"top":25.4,"bottom":25.4,"left":25.4,"right":25.4},"pageNumbers":{"enabled":true,"format":"simple","position":"bottom-center"}},"epub":{"chapterSplitLevel":"h1","coverPath":"cover.png"},"text":{"fullwidthSpaceIndent":true,"indentCount":1}}
```

全 field は optional で、`resolveExportProfile({})` は `DEFAULT_EXPORT_PROFILE` を返します（`metadata` の default は `{}`）。指定したい値だけを上書きしてください。

| Field | 型 / default | validation |
| --- | --- | --- |
| `metadata.title` / `author` / `publisher` / `identifier` / `language` / `date` | optional `string` | 指定時は string |
| `typesetting.writingMode` | `"horizontal"` | `"horizontal" \| "vertical"` |
| `typesetting.fontFamily` | `"serif"` | 空でない string（空白のみは default） |
| `typesetting.textIndentEm` | `1` | `0`–`4` |
| `typesetting.fullwidthSpaceIndent` | `false` | boolean |
| `pagination.pageSize` | `"A4"` | `PAGE_DIMENSIONS` の key（A/B 判、Bunko、Letter、Hagaki 等） |
| `pagination.landscape` | `false` | boolean |
| `pagination.charactersPerLine` / `linesPerPage` | `40` / `34` | `10`–`60` / `10`–`50` |
| `pagination.margins.*` | 各 `25.4` mm | `0`–`50` |
| `pagination.pageNumbers` | enabled / simple / bottom-center | format は `simple\|dash\|fraction`、位置は 6 種 |
| `epub.chapterSplitLevel` / `coverPath` | `"h1"` / optional | `h1\|h2\|h3\|none`、CLI cover は jpg/jpeg/png |
| `text.fullwidthSpaceIndent` / `indentCount` | `false` / `1` | boolean / `1`–`4` |

不正値は clamp/ignore せず field 名を含む `Error` になります。`resolveExportProfile()` だけでなく CLI が使う `parseExportProfileJson()` も同じ validation を行います。

## 使用方法

```bash
mdi build novel.mdi --to pdf --config novel.export.json -o novel.pdf
mdi build novel.mdi --to docx --config novel.export.json
mdi build novel.mdi --to epub --config novel.export.json
mdi build novel.mdi --to txt-ruby --config novel.export.json
```

```ts
import { parseExportProfileJson, resolveExportProfile } from "@illusions-lab/mdi-export-profile";
const profile = parseExportProfileJson(await readFile("novel.export.json", "utf8"));
const resolved = resolveExportProfile(profile);
```

`resolvePrintProfile(profile, sourceWritingMode)` は document writing mode を default にし、vertical では default landscape を `true` にします。明示した profile は常に front matter より優先します。

## Format support today

| Setting | PDF | TXT | EPUB / DOCX |
| --- | --- | --- | --- |
| geometry/font/page number | Yes | — | **Pending** |
| front matter metadata/writing mode | Yes | — | Yes（profile からではない） |
| full-width-space indent | Yes | Yes | **Pending** |
| cover/chapter split | — | — | **Pending** |

この表にない format が field を使うと仮定しないでください。対応状況は [Rust Core API](/ja/core/rust-api/#not-yet-implemented) の実装が進むと変わります。

## 次へ

- [CLI](/ja/bindings/cli/)
- [Rust Core API](/ja/core/rust-api/)
