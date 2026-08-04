---
title: JavaScript / TypeScript
description: Rust が決めた MDI の意味を JavaScript から使い、baseline と設定付き export を選ぶ方法。
---

**前提:** [Getting Started](/ja/guides/getting-started/)、[Document IR](/ja/core/document-ir/)。

## Install と parse-first

```bash
npm install @illusions-lab/mdi
```

この package は `mdi-core` を prebuilt WASM として実行します。Node.js と WASM import 対応 bundler で動き、利用側で native build は不要です。editor/export UI ではまず `parse()` して warning と span を表示します。

```ts
import { parse, renderHtmlWithDiagnostics } from "@illusions-lab/mdi";

const source = "# 第一章\n{東京|とうきょう}は雨だった。";
const parsed = parse(source);
if (parsed.diagnostics.some((item) => item.severity === "error")) {
  // code と UTF-8 byte span を editor に表示する
}
const result = renderHtmlWithDiagnostics(source, { bodyOnly: true });
console.log(result.output);   // <body> の semantic contents
console.log(result.headings); // depth、text、span を持つ source-order headings
```

`parse` は Rust-owned `document`、`diagnostics`、UTF-8 byte span を返します。構文の誤りの多くは throw ではなく literal fallback になります。warning の全一覧は [Diagnostics](/ja/core/diagnostics/) を参照してください。`prepareRender(source)` も parse-first 用です。`*WithDiagnostics` は output と同じ parser result を返しますが、warning を error に変えるものではありません。

`renderHtml(source)` は MDI stylesheet 付き standalone HTML を返します。app が外側の page を持つなら `{ bodyOnly: true }` を使います。semantic HTML は stable な `mdi-ruby`、`mdi-tcy`、`mdi-em`、`mdi-pagebreak` 等の class を付けます。

## Browser の初期化

browser では synchronous API を呼ぶ前に、WebAssembly runtime を一度だけ
`await` してください。`initializeMdi()` は single-flight かつ idempotent です。
同時呼び出しは一つの初期化を共有します。Node.js は eager load のため直ちに
resolve します。

```ts
import { initializeMdi, parse, serializeMdi } from "@illusions-lab/mdi";

await initializeMdi();
const parsed = parse("{東京|とうきょう} ^12^");
const canonical = serializeMdi("{東京|とうきょう} ^12^");
```

`browser` export condition を使う Vite などの bundler は web facade を選び、
private な WASM asset を自動で emit します。generated wasm-pack loader を直接
import しないでください。browser の初期化が失敗しても、`initializeMdi()` を
再度呼べば安全に retry できます。

## プレーンテキスト検索 index

`getMdiTextBlocks(source)` は Rust で一度だけ parse し、source order の text
block、完全な document IR、diagnostics を返します。`3:18` は三つ目の block の
十八番目の Unicode grapheme を表します。ruby の reading は別 channel の
annotation として検索でき、`anchor` は base text の range を指します。

```ts
import { getMdiTextBlocks, sourceSpansForTextRange } from "@illusions-lab/mdi";

const result = getMdiTextBlocks("# 題\n\n{東京|とうきょう}");
const paragraph = result.blocks[1];
const match = { start: "2:1", end: "2:3" } as const;

console.log(paragraph.text); // 東京
console.log(paragraph.annotations[0].text); // とうきょう
console.log(sourceSpansForTextRange(paragraph, match)); // UTF-8 source span
```

`sourceMap.synthetic` は table の tab や row newline など projection が追加した
separator を示し、source span は作りません。`parseMdiTextPosition`、
`formatMdiTextPosition`、`formatMdiTextRange` は canonical な座標表記用の
stateless helper です。

## baseline と設定付き EPUB/DOCX

一引数の API は synchronous Rust baseline export です。

```ts
import { renderEpub, renderDocx } from "@illusions-lab/mdi";
await writeFile("book.epub", renderEpub(source));
await writeFile("book.docx", renderDocx(source));
```

publication 設定が必要なら二引数 overload（または `WithProfile`）を `await` します。Promise 形式は互換性のために残していますが、profile の検証と EPUB/DOCX の生成は Rust で行います。JavaScript は MDI を再 parse せず、別の document generator も持ちません。

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

EPUB は metadata、縦書き、font、indent、`h1`/`h2`/`h3`/`none` chapter split、PNG/JPEG `Uint8Array` cover を扱います。DOCX は metadata、page size/orientation/margin、font/size/line spacing/indent、page number（`simple`/`dash`/`fraction`）を扱います。どちらも full nested `ExportProfile` も使えます。JSON の全 schema は [Export profiles](/ja/ecosystem/export-profiles/) を参照してください。

設定付き export は必ず `layout.system` を指定します。`"japanese-publisher"` は mirrored の和文 book 用で、横書きは 10 pt 明朝体の `Shirokuban`・左綴じ 27 字 × 26 行 strict grid、縦書きは A4 landscape の小説原稿・右綴じ 40 字 × 30 行 strict grid が default です。`"word"` は Word 形式の flowing page 用で、default は A4、四辺 25.4 mm、mirror なし、`gridMode: "typographic"` です。`"word"` は `"strict"` を reject します。

## 各層の担当と DOCX の限界

Rust が grammar、diagnostic、span、profile validation、canonical な紙面 catalogue、設定付き EPUB/DOCX generation を担当します。PDF でも styled HTML、page geometry、page-number template は Rust が準備し、host は Chromium と application UI だけを扱います。DOCX は page break、縦書き、paragraph/run を OOXML に落としますが、ruby、tate-chu-yoko、禁則/改行禁止、kern、強制 blank paragraph を browser HTML と pixel-identical に再現する約束ではありません。重要な組版は利用者が使う Word-compatible reader で確認してください。

## HTML/PDF host

```ts
import { preparePdfExport, renderPdfWithChromium } from "@illusions-lab/mdi/node";

const request = preparePdfExport(source, profile); // Electron の print API に渡せる
const pdf = await renderPdfWithChromium(source, profile);
```

Node の default PDF host には別途 `npm install @illusions-lab/mdi-to-pdf` が必要です。Electron は `{ renderHtmlToPdf(html, profile, sourceWritingMode) }` を渡せます。PDF の paper、landscape、margin、縦横、font、font size/line spacing、文字数/行数、indent、page number は Rust が解決します。browser/WASM でも設定付き EPUB/DOCX は生成できます。Chromium を起動する PDF だけは `preparePdfExport()` を Node/Electron/Tauri/CLI host に送ります。

非 string source と不正 option は `TypeError` です。diagnostic は document feedback として扱い、I/O/archive/host renderer の failure だけを `try`/`catch` してください。span は JavaScript index ではなく UTF-8 **byte** offset です。
