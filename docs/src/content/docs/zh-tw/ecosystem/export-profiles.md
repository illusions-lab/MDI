---
title: 匯出設定檔
description: 真實且經驗證的 ExportProfile schema：每個欄位、預設值，以及目前哪些輸出格式會採用它。
---

**先備知識：**[快速開始](/zh-tw/guides/getting-started/)。

匯出設定檔（export profile）設定的是特定輸出的**呈現方式**：頁面大小、字型、邊界、縮排、頁碼。它絕不改變 MDI 語法或意義；同一份來源搭配兩個 profile，會產生外觀不同、但仍是同一文件的兩份 PDF。套件為 `@illusions-lab/mdi-export-profile`；`resolveExportProfile` 會驗證每個欄位，格式錯誤時拋出說明清楚的 `Error`，不會悄悄接受不正確的版面資料。

## Schema

```json
{
  "metadata": { "title": "The Last Station", "author": "A Writer", "publisher": "Example Press", "identifier": "isbn:9780000000000" },
  "typesetting": { "writingMode": "horizontal", "fontFamily": "Noto Serif JP", "textIndentEm": 1, "fullwidthSpaceIndent": false },
  "pagination": {
    "pageSize": "A4", "landscape": false, "charactersPerLine": 40, "linesPerPage": 34,
    "margins": { "top": 25.4, "bottom": 25.4, "left": 25.4, "right": 25.4 },
    "pageNumbers": { "enabled": true, "format": "simple", "position": "bottom-center" }
  },
  "epub": { "chapterSplitLevel": "h1", "coverPath": "cover.png" },
  "text": { "fullwidthSpaceIndent": true, "indentCount": 1 }
}
```

每個頂層鍵與每個欄位都是**選填**；`resolveExportProfile({})` 會回傳 `DEFAULT_EXPORT_PROFILE`（如上，但 `metadata` 預設為 `{}`）。只傳入要覆寫的欄位即可。

| 欄位 | 型別 | 預設值 | 驗證 |
| --- | --- | --- | --- |
| `metadata.title`／`author`／`publisher`／`identifier`／`language`／`date` | `string` | — | 若存在，必須是字串。 |
| `typesetting.writingMode` | `"horizontal" \| "vertical"` | `"horizontal"` | 必須剛好是兩者之一。 |
| `typesetting.fontFamily` | `string` | `"serif"` | 必須是非空字串；全空白會回退至預設值。 |
| `typesetting.textIndentEm` | `number` | `1` | `0`–`4`。 |
| `typesetting.fullwidthSpaceIndent` | `boolean` | `false` | — |
| `pagination.pageSize` | `PAGE_SIZES` 之一 | `"A4"` | 必須是匯出 `PAGE_DIMENSIONS` map 的鍵（ISO A0–A10、JIS/ISO B0–B10、`Bunko`／`Shinsho`／`Tankobon` 等日文書籍尺寸、`Letter`／`Legal`／`Tabloid`，以及 `Hagaki`／`L-ban` 等明信片／相片尺寸）。 |
| `pagination.landscape` | `boolean` | `false` | — |
| `pagination.charactersPerLine` | `number` | `40` | `10`–`60`。 |
| `pagination.linesPerPage` | `number` | `34` | `10`–`50`。 |
| `pagination.margins.{top,bottom,left,right}` | `number`（mm） | 各 `25.4`（1 英吋） | `0`–`50`。 |
| `pagination.pageNumbers.enabled` | `boolean` | `true` | — |
| `pagination.pageNumbers.format` | `"simple" \| "dash" \| "fraction"` | `"simple"` | 必須是三者之一。 |
| `pagination.pageNumbers.position` | 六種 `*-{left,center,right}` 組合之一 | `"bottom-center"` | 必須是六種之一。 |
| `epub.chapterSplitLevel` | `"h1" \| "h2" \| "h3" \| "none"` | `"h1"` | 必須是四者之一。 |
| `epub.coverPath` | `string`（相對於 `--config` 檔案解析的路徑） | — | CLI 使用時必須是 `.jpg`／`.jpeg`／`.png`。 |
| `text.fullwidthSpaceIndent` | `boolean` | `false` | — |
| `text.indentCount` | `number` | `1` | `1`–`4`。 |

不符合限制的值，例如不支援的 `pageSize`、`charactersPerLine: 5`、或 `writingMode: "rtl"`，都會由直接呼叫的 `resolveExportProfile()` 與 CLI `--config` 所使用的 `parseExportProfileJson()` 拋出明確指出欄位的 `Error`；不會被靜默截斷或忽略。

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
const resolved = resolveExportProfile(profile); // 補齊每個欄位並完成驗證
```

`resolvePrintProfile(profile, sourceWritingMode)` 是 PDF／列印路徑使用的小型便利包裝：文件 front matter 的 `writing-mode` 可提供預設書寫方向（明確指定的 profile 優先），而直排預設 `landscape: true`，因為直排字格在橫向紙張上較易閱讀。

## 目前格式支援

| 設定 | PDF | TXT／`txt-ruby` | EPUB／DOCX |
| --- | --- | --- | --- |
| 頁面幾何、字型、頁碼 | 是 | — | **尚待完成** — Rust `render_epub`／`render_docx` 尚不讀取 profile |
| Front matter metadata／書寫方向 | 是 | — | 是（直接讀取 front matter，不是 profile） |
| 全形空白縮排 | 是 | 是（透過 `text.indentCount`，1–4 個空白） | **尚待完成** |
| 封面圖片、分章層級 | — | — | **尚待完成** |

當 [Rust Core API 狀態：尚未實作](/zh-tw/core/rust-api/#尚未實作) 縮小時，這張表也會變動。不要假設未列出的格式會採用欄位；請先查看該頁的目前權威狀態。

## 下一步

- [CLI 綁定](/zh-tw/bindings/cli/) — 在脈絡中了解 `--config`。
- [Rust Core API 狀態](/zh-tw/core/rust-api/) — 確切知道目前有哪些 renderer 函式與參數。
