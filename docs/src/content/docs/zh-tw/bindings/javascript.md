---
title: JavaScript / TypeScript
description: 從 JavaScript 使用 Rust 決定的 MDI 語意，並選擇 baseline 或可設定的匯出。
---

**先備知識：**[快速開始](/zh-tw/guides/getting-started/)、[Document IR](/zh-tw/core/document-ir/)。

## 安裝與先 parse

```bash
npm install @illusions-lab/mdi
```

此 package 以預建 WASM 執行 `mdi-core`。可用於 Node.js 與支援 WASM import 的 bundler，consumer machine 不需 native build。編輯器或匯出 UI 應先 `parse()`，讓 warning 與 span 可被顯示：

```ts
import { parse, renderHtmlWithDiagnostics } from "@illusions-lab/mdi";

const source = "# 第一章\n{東京|とうきょう}は雨だった。";
const parsed = parse(source);
if (parsed.diagnostics.some((item) => item.severity === "error")) {
  // 用 code 與 UTF-8 byte span 標示 editor
}
const result = renderHtmlWithDiagnostics(source, { bodyOnly: true });
console.log(result.output);   // <body> 的 semantic contents
console.log(result.headings); // source-order heading 的 depth、text、span
```

`parse` 回傳 Rust-owned `document`、`diagnostics` 與 UTF-8 byte span。多數格式錯誤採 literal fallback，不會 throw；完整 warning 清單見[診斷](/zh-tw/core/diagnostics/)。`prepareRender(source)` 也適合 parse-first workflow。`*WithDiagnostics` 會保留 output 與 parser result，但不會自動把 warning 變成 error。

`renderHtml(source)` 回傳含 MDI stylesheet 的 standalone HTML；app 擁有外層頁面時傳 `{ bodyOnly: true }`。semantic HTML 有穩定的 `mdi-ruby`、`mdi-tcy`、`mdi-em`、`mdi-pagebreak` 等 class。

## Browser 初始化

在 browser 中呼叫同步 API 前，先 `await` 一次 WebAssembly runtime。
`initializeMdi()` 是 single-flight 且 idempotent：並行呼叫會共用同一個初始化；
Node.js 因為 eager load，會立刻 resolve。

```ts
import { initializeMdi, parse, serializeMdi } from "@illusions-lab/mdi";

await initializeMdi();
const parsed = parse("{東京|とうきょう} ^12^");
const canonical = serializeMdi("{東京|とうきょう} ^12^");
```

Vite 與其他遵循 `browser` export condition 的 bundler 會自動選擇 web facade 並
emit 私有 WASM asset。不要直接 import generated wasm-pack loader。若 browser
初始化失敗，可再次呼叫 `initializeMdi()` 安全地重試。

## 建立純文字搜尋索引

`getMdiTextBlocks(source)` 只在 Rust parse 一次，回傳依 source order 排列的 text
blocks、完整 document IR 與 diagnostics。`3:18` 表示第三個 block 的第十八個
Unicode grapheme。Ruby 讀音會作為可搜尋的獨立 annotation channel，而 `anchor`
仍指回正文 base text 的 range。

```ts
import { getMdiTextBlocks, resolveMdiSourceSpan, resolveMdiSourceSpans, sourceSpansForTextRange } from "@illusions-lab/mdi";

const result = getMdiTextBlocks("# 題\n\n{東京|とうきょう}");
const paragraph = result.blocks[1];
const match = { start: "2:1", end: "2:3" } as const;

console.log(paragraph.text); // 東京
console.log(paragraph.annotations[0].text); // とうきょう
console.log(sourceSpansForTextRange(paragraph, match)); // UTF-8 source spans
console.log(resolveMdiSourceSpan("# 題\n\n{東京|とうきょう}", { startByte: 8, endByte: 14 }));
console.log(resolveMdiSourceSpans("same same", [{ startByte: 0, endByte: 4 }, { startByte: 5, endByte: 9 }]));
```

`sourceMap.synthetic` 指出 projection 額外加入的 separator，例如 table 的 tab 與
row newline；它們不會偽造 source span。`parseMdiTextPosition`、
`formatMdiTextPosition`、`formatMdiTextRange` 是 canonical 座標格式的無狀態 helper。

`resolveMdiSourceSpan(source, span)` 由 Rust 執行反向解析。輸入是 half-open UTF-8
byte uint32，必須有序、位於 source 範圍內且落在 code-point boundaries。結果依
block、正文優先、零基底 annotation index 排序，coverage 為
`complete | partial | none`。只有 match 的完整 forward coverage 恰等於輸入時
才是 `exact`，其餘交集為 `overlap`。Ruby base 與 reading 是獨立 channel；空
span 不視為 caret，也不回傳鄰近 range。純結構 delimiter、synthetic 與 unmapped
byte 不會取得虛構 range，因此 annotation、多對一 token、partial grapheme、
discontinuous mapping 等情況不保證 round trip 是雙射。

同一文件有多個 diagnostics 或 decorations 時，請使用
`resolveMdiSourceSpans(source, spans)`。它先驗證全部 span，再由 Rust 只做一次
parse/projection，並依輸入順序回傳結果；分別呼叫單筆 API 則每次都會重新 parse。

## baseline 與可設定 EPUB/DOCX

一個參數的 API 是 synchronous Rust baseline export：

```ts
import { renderEpub, renderDocx } from "@illusions-lab/mdi";
await writeFile("book.epub", renderEpub(source));
await writeFile("book.docx", renderDocx(source));
```

需要出版設定時，使用兩個參數的 overload（或明確的 `WithProfile` 名稱）並 `await`。Promise 形式是為了保持相容；profile 驗證與 EPUB/DOCX 生成都在 Rust 內完成。JavaScript 不會重新 parse MDI，也沒有另一套 document generator。

```ts
const epub = await renderEpub(source, {
  profile: { layout: { system: "japanese-publisher" } },
  title: "雨の東京", author: "Illusions", language: "ja",
  publisher: "Illusions Lab", identifier: "urn:isbn:example", date: "2026-07-21",
  verticalWriting: true, fontFamily: "Yu Mincho", textIndent: 1,
  chapterSplitLevel: "h1", coverImage: coverBytes, coverMediaType: "image/png",
});

const docx = await renderDocx(source, {
  layout: { system: "word" },
  title: "雨の東京", author: "Illusions", verticalWriting: true,
  fontFamily: "Yu Mincho", fontSize: 11, lineSpacing: 1.6, textIndent: 1,
  pagination: { gridMode: "typographic" },
  pageSize: "A5", landscape: false,
  margins: { top: 18, right: 15, bottom: 18, left: 15 },
  showPageNumbers: true, pageNumberPosition: "bottom-center", pageNumberFormat: "simple",
});
```

EPUB 支援 metadata、直排、font、indent、`h1`/`h2`/`h3`/`none` chapter split，以及 PNG/JPEG `Uint8Array` cover。DOCX 支援 metadata、page size/orientation/margin、font/size/line spacing/indent、page number（`simple`/`dash`/`fraction`）。兩者亦支援完整 nested `ExportProfile`；完整 JSON schema 見 [export profiles](/zh-tw/ecosystem/export-profiles/)。

每個設定型 export 都必須寫出 `layout.system`。`"japanese-publisher"` 用於鏡像的日文書籍：橫書預設為 10 pt 明朝體與 `Shirokuban`、左裝訂 27 字 × 26 行 strict grid；直書預設為 A4 landscape 小說原稿、右裝訂 40 字 × 30 行 strict grid。`"word"` 用於 Word 式流動頁面：預設 A4、四邊 25.4 mm、無鏡像、`gridMode: "typographic"`；`"word"` 會拒絕 `"strict"`。

## 各層負責什麼，以及 DOCX 的限制

Rust 負責 grammar、diagnostic、span、profile validation、canonical 紙張目錄，以及設定型 EPUB/DOCX generation。PDF 的 styled HTML、page geometry 與 page-number template 也由 Rust 準備；host 只控制 Chromium 與 app UI。DOCX 可將 page break、直排及一般 paragraph/run 對應到 OOXML，但不承諾 ruby、tate-chu-yoko、禁則/不換行、kern、強制 blank paragraph 與 browser HTML 像素一致。這些日文排版很重要時，請用讀者實際使用的 Word-compatible reader 驗證。

## HTML/PDF host

```ts
import { preparePdfExport, renderPdfWithChromium } from "@illusions-lab/mdi/node";

const request = preparePdfExport(source, profile); // 可交給 Electron print API
const pdf = await renderPdfWithChromium(source, profile);
```

Node 的 default PDF host 要另外 `npm install @illusions-lab/mdi-to-pdf`。Electron 可傳入 `{ renderHtmlToPdf(html, profile, sourceWritingMode) }`。PDF 的紙張、橫向、邊距、直/橫排、font、font size/line spacing、每行字數/每頁行數、indent、page number 都由 Rust 解決。browser/WASM 可在本機生成設定型 EPUB/DOCX；只有 PDF 因無法啟動 Chromium，需要把 `preparePdfExport()` 交給 Node/Electron/Tauri/CLI host。

非字串 source 與無效 option 都是 `TypeError`。diagnostic 應作為 document feedback；只有 I/O/archive/host renderer failure 才適合 `try`/`catch`。span 是 UTF-8 **byte** offset，不是 JavaScript string index。


### Automatic warichu layout

自動割注使用正文50%字級與固定兩行。`layoutMdiWarichu(children, { firstCapacity, continuationCapacity })` 呼叫Rust分割規則；唯讀HTML使用 `attachMdiWarichuLayout(container)`，列印前使用 `settleMdiPrintLayout(evaluate, { timeoutMs, signal })`。自動分割只影響呈現，不改寫MDI。無腳本HTML與EPUB保留雙行結構，但閱讀器重排可能不同。
