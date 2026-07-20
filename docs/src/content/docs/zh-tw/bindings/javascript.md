---
title: JavaScript / TypeScript
description: "@illusions-lab/mdi：主要的 Rust-backed JavaScript API，及每個 export 的實際行為。"
---

**先備知識：**[快速開始](/zh-tw/guides/getting-started/)、[Document IR](/zh-tw/core/document-ir/)。

## 這個綁定解決什麼

在 Node.js、bundler web app 或其他 JavaScript/TypeScript 環境解析或轉譯 `.mdi`，不需呼叫 CLI。`@illusions-lab/mdi` 將 `mdi-core` 編譯為 WebAssembly 並以 typed functions 提供；package 中沒有任何 JavaScript-side MDI grammar 重作。

## 安裝

```bash
npm install @illusions-lab/mdi
```

可在 Node.js 及支援 WASM imports 的 bundler（Vite、Webpack 5+、含 WASM loader 的 esbuild）使用；consumer machine 不需 native build，WASM binary 已隨 npm package 預建。

## 最小可執行範例

```ts
import { parse, renderHtml } from "@illusions-lab/mdi";
const source = "第^12^話。{東京|とうきょう}は雨だった。";
const result = parse(source);
console.log(result.syntaxVersion, result.irVersion); // "2.0" "1.0"
console.log(result.document.children.length); // 1
console.log(result.diagnostics); // []
console.log(renderHtml(source));
```

## 所有 exported function

```ts
import { parse, renderHtml, renderText, renderTextFormat, renderEpub, renderDocx,
  serializeMdi, parseMdiSyntax, MDI_SPEC_VERSION, MDI_IR_VERSION } from "@illusions-lab/mdi";
type MdiTextFormat = "txt" | "txt-ruby" | "narou" | "kakuyomu" | "aozora";
```

`parseMdiSyntax` 是 deprecated `parse` alias。每個 function 接收**完整** source 並各自解析；JavaScript API 今日沒有「parse 一次、重複 render」call，因此大型文件多格式 render 有真實的重複 parse 成本。

## 輸入與輸出型別

`parse(source)` 回傳 `MdiSyntaxParseResult`，包括 `irVersion: "1.0"`、`syntaxVersion: "2.0"`、`capabilities`（`mdi`、`commonMark`、`gfm`、`frontMatter`、`sourceSpans`）、`document: MdiDocument` 和 `diagnostics: MdiDiagnostic[]`。`renderHtml`、`renderText`、`renderTextFormat`、`serializeMdi` 回傳普通字串；`renderEpub`／`renderDocx` 回傳 `Uint8Array`，應以 `fs.writeFile` 寫入檔案或在瀏覽器交給 `Blob`，不可當 UTF-8 文字解碼。

## Diagnostics 與 error handling

`parse` 幾乎不 throw。非字串 source 為 `TypeError: source must be a string`；WASM `irVersion` 與此 package 預期不符時為 `Error: Unsupported MDI IR version: ...`。格式不良的 MDI syntax 不 throw，而是套用 literal fallback；`diagnostics` 只有目前已實作的 `mdi.version.unsupported` 情況，詳見[診斷](/zh-tw/core/diagnostics/)。不要以 `try`/`catch` 取代檢查 diagnostics。

## IR version 與 UTF-8 byte spans

`MDI_IR_VERSION` 今日為 `"1.0"`。`parse` 會拒絕 WASM 回傳的不同版本，避免 version-skew 被靜默誤讀。`document` 每個 span 都是 UTF-8 **byte** offset，不是 JavaScript string index；轉換方法見[診斷與 UTF-8 source spans](/zh-tw/core/diagnostics/#spans精確來說)。

## 目前實作狀態

上述每個 function 都真實存在並直接呼叫 Rust，沒有 stub。`renderEpub`/`renderDocx` 是[轉譯模型](/zh-tw/core/rendering/#epub-與-docxbaseline-的具體含義)所述 baseline（尚無 export-profile cover/chapter-split 支援）；此 package 沒有 PDF function，因 WASM 不能 launch process。

## 此綁定不做什麼

- **沒有 PDF。**WASM 不能啟動 Chromium；PDF 請用 `@illusions-lab/mdi-cli` 或 Node.js host 的 `@illusions-lab/mdi-to-pdf`。
- **沒有自己的 grammar。**若與 CLI/Rust 對文字意義不一致，即為 `mdi-core` bug。
- **不套用 export profile。**page size、font、margin 由 `@illusions-lab/mdi-export-profile` 與 CLI `--config` 處理，見[export profiles](/zh-tw/ecosystem/export-profiles/)。

## 下一步

- [Rust Core API](/zh-tw/core/rust-api/)
- [Remark / mdast adapter](/zh-tw/ecosystem/remark/)
- [CLI](/zh-tw/bindings/cli/)
