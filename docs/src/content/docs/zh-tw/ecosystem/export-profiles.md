---
title: 匯出設定檔
description: 經驗證的 ExportProfile schema、兩種 layout system，以及各輸出格式目前採用的設定。
---

**先備知識：**[快速開始](/zh-tw/guides/getting-started/)。

export profile 設定的是頁面、字型、邊界、縮排與頁碼等**呈現**；它不改變 MDI syntax 或文件語意。套件為 `@illusions-lab/mdi-export-profile`。JavaScript API 會把 validation 與 default resolution 交給 `mdi-core`，再回傳有型別的結果，或包含 field 名且容易理解的 `Error`。

## Schema 與必填 system

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

`resolveExportProfile({})` 可供內部/default resolution 使用，但 CLI `--config` 與設定型 `@illusions-lab/mdi` export 必須提供 `layout.system`。請選擇一個 contract：嚴格日文書籍的 `"japanese-publisher"`，或流動 Word 頁面的 `"word"`；兩者不能混用。

| 欄位 | 型別 / 預設 | 條件 |
| --- | --- | --- |
| `layout.system` | `"japanese-publisher" \| "word"` | 設定型 export 必填；選擇整套 layout contract。 |
| `layout.marginMode` / `bindingSide` / `gutter` | publisher: mirror / 依方向 / 0 mm | `word` 為 single margin，沒有 gutter。 |
| `metadata.*` | optional `string` | 指定時必須為 string。 |
| `typesetting.writingMode` | `"horizontal"` | `"horizontal" \| "vertical"`。 |
| `fontFamily` / `fontSize` / `lineSpacing` | Mincho stack / system default / optional | `lineSpacing` 僅可用於 typographic。 |
| `pagination.pageSize` | publisher 橫書：`Shirokuban`；直書：A4 landscape；word：`A4` | Rust 管理的 67 種 catalogue key。 |
| `charactersPerLine` / `linesPerPage` | publisher 橫書 27×26；直書 40×30 | 10–400；word 的 count 僅供資訊，不是頁面契約。 |
| `gridMode` | publisher: `strict`; word: `typographic` | `word` 拒絕 strict；strict 拒絕 line spacing。 |
| `margins` | publisher: 16.5/18/18/15.5 mm；word: 四邊 25.4 mm | 必須留下 printable area。 |
| `pageNumbers` | enabled / simple / bottom-center | format 為 `simple` / `dash` / `fraction`，位置有 6 種。 |
| `epub.chapterSplitLevel` / `coverPath` | `h1` / optional | `h1`/`h2`/`h3`/`none`；CLI cover 為 PNG/JPEG。 |
| `text.fullwidthSpaceIndent` / `indentCount` | false / 1 | boolean / 1–4。 |

`japanese-publisher` 的預設為鏡像跨頁：橫書是 10 pt 明朝體的 `Shirokuban`、左裝訂 27 字 × 26 行；直書是 A4 landscape 小說原稿、右裝訂 40 字 × 30 行 strict grid。`word` 預設為 A4、四邊 25.4 mm、無鏡像的流動 `typographic` layout。

## 使用方式

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

`resolvePrintProfile(profile, sourceWritingMode)` 是 PDF/print 的 wrapper。文件 front matter 的 writing mode 是 default，明確 profile 優先；它不會為直書悄悄改成 landscape。

## 目前格式支援

| 設定 | PDF | TXT / `txt-ruby` | EPUB / DOCX |
| --- | --- | --- | --- |
| 頁面幾何、字型、頁碼 | 是 | — | DOCX：是；EPUB 使用 typography，但為 reflowable。 |
| metadata / writing mode | 是 | — | EPUB / DOCX：是。 |
| 全形空白縮排 | 是 | 是（`text.indentCount` 為 1–4） | EPUB / DOCX：是。 |
| cover image、chapter split | — | — | EPUB：是。 |

Default、validation rule、physical paper dimensions 與 renderer-facing
profile 都由 `mdi-core` 管理。JavaScript package 補上 TypeScript type 和
日文 UI label，但不另外保存 layout table。EPUB 為 reflowable，不能承諾
固定 physical pages。

## 下一步

- [CLI 綁定](/zh-tw/bindings/cli/)
- [轉譯模型](/zh-tw/core/rendering/)
