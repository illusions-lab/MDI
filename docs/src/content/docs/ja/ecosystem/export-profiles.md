---
title: Export profile
description: 検証される ExportProfile schema、二つの layout system、そして各出力形式が現在使う設定。
---

**前提:** [Getting Started](/ja/guides/getting-started/)。

export profile は page、font、margin、indent、page number という**表示**を決めます。MDI syntax や document の意味は変えません。package は `@illusions-lab/mdi-export-profile` です。JavaScript API は validation と default resolution を `mdi-core` に渡し、typed result または field 名を含む読みやすい `Error` を返します。

## Schema と必須の system

```json
{
  "layout": { "system": "word" },
  "metadata": { "title": "The Last Station", "author": "A Writer", "publisher": "Example Press", "identifier": "isbn:9780000000000" },
  "typesetting": { "writingMode": "horizontal", "fontFamily": "Noto Serif JP", "fontSize": 10.5, "lineSpacing": 1.4, "textIndentEm": 1 },
  "pagination": {
    "pageSize": "A4", "landscape": false, "gridMode": "typographic",
    "margins": { "top": 25.4, "bottom": 25.4, "left": 25.4, "right": 25.4 },
    "pageNumbers": { "enabled": true, "format": "simple", "position": "bottom-center" }
  },
  "epub": { "chapterSplitLevel": "h1", "coverPath": "cover.png" },
  "text": { "fullwidthSpaceIndent": true, "indentCount": 1 }
}
```

`resolveExportProfile({})` は internal の default resolution 用ですが、CLI の `--config` と設定付き `@illusions-lab/mdi` export では `layout.system` が必須です。`"japanese-publisher"`（strict な和文 book）か `"word"`（flowing Word page）を一つ選びます。二つの contract は混ぜません。

| Field | 型 / default | 条件 |
| --- | --- | --- |
| `layout.system` | `"japanese-publisher" \| "word"` | 設定付き export では必須。layout 全体を選ぶ。 |
| `layout.marginMode` / `bindingSide` / `gutter` | publisher: mirror / direction-dependent / 0 mm | `word` は single margin、gutter なし。 |
| `metadata.*` | optional `string` | 指定時は string。 |
| `typesetting.writingMode` | `"horizontal"` | `"horizontal" \| "vertical"`。 |
| `fontFamily` / `fontSize` / `lineSpacing` | Mincho stack / system default / optional | `lineSpacing` は typographic のみ。 |
| `pagination.pageSize` | publisher horizontal: `Shirokuban`; vertical: A4 landscape; word: `A4` | Rust が持つ 67 種の catalogue key。 |
| `charactersPerLine` / `linesPerPage` | publisher horizontal: 27×26; vertical: 40×30 | 10–400。word の count は情報用で、page contract ではない。 |
| `gridMode` | publisher: `strict`; word: `typographic` | `word` は strict を reject。strict は line spacing を reject。 |
| `margins` | publisher: 16.5/18/18/15.5 mm; word: 四辺 25.4 mm | printable area を残す必要がある。 |
| `pageNumbers` | enabled / simple / bottom-center | format は `simple` / `dash` / `fraction`、位置は 6 種。 |
| `epub.chapterSplitLevel` / `coverPath` | `h1` / optional | `h1`/`h2`/`h3`/`none`。CLI cover は PNG/JPEG。 |
| `text.fullwidthSpaceIndent` / `indentCount` | false / 1 | boolean / 1–4。 |

`japanese-publisher` の default は mirror spread です。横書きは 10 pt Mincho の `Shirokuban`、左綴じ 27 字 × 26 行、縦書きは A4 landscape の小説原稿、右綴じ 40 字 × 30 行の strict grid になります。`word` の default は A4、四辺 25.4 mm、mirror なしの flowing `typographic` layout です。

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

`resolvePrintProfile(profile, sourceWritingMode)` は PDF/print 用の wrapper です。front matter の writing mode を default とし、明示した profile を優先します。paper orientation を vertical のために勝手に landscape へ変更しません。

## 現在の format support

| 設定 | PDF | TXT / `txt-ruby` | EPUB / DOCX |
| --- | --- | --- | --- |
| page geometry、font、page number | Yes | — | DOCX: Yes。EPUB は typography を使うが reflowable。 |
| metadata / writing mode | Yes | — | EPUB / DOCX: Yes。 |
| full-width-space indent | Yes | Yes（`text.indentCount` で 1–4） | EPUB / DOCX: Yes。 |
| cover image、chapter split | — | — | EPUB: Yes。 |

default、validation rule、physical paper dimensions、renderer 用 profile は
`mdi-core` が管理します。JavaScript package は TypeScript type と日本語 UI
label を加えますが、別の layout table は持ちません。EPUB は reflowable
なので固定の physical page を約束しません。

## 次へ

- [CLI](/ja/bindings/cli/)
- [レンダリングモデル](/ja/core/rendering/)
