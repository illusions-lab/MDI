---
title: JavaScript / TypeScript
description: Rust-backed JavaScript API @illusions-lab/mdi。
---

**前提:** [Getting Started](/ja/guides/getting-started/)、[Document IR](/ja/core/document-ir/)。

## この binding で解決すること

`@illusions-lab/mdi` は `mdi-core` を WebAssembly に compile した binding です。Node.js、bundler を使う Web app、その他の JavaScript/TypeScript 環境から CLI を起動せずに `.mdi` を解析・描画できます。JavaScript 側に MDI grammar の再実装はありません。

## Install

```bash
npm install @illusions-lab/mdi
```

Node.js および WASM import を扱える bundler（Vite、Webpack 5+、WASM loader を持つ esbuild）で動き、WASM binary は package に同梱されます。利用側マシンで native build は不要です。

## 最小例

```ts
import { parse, renderHtml } from "@illusions-lab/mdi";
const source = "第^12^話。{東京|とうきょう}は雨だった。";
const result = parse(source);
console.log(result.syntaxVersion, result.irVersion); // "2.0" "1.0"
console.log(result.document.children.length);        // 1（paragraph 一つ）
console.log(result.diagnostics);                     // []
console.log(renderHtml(source));
```

## Export される全関数

```ts
import { parse, renderHtml, renderText, renderTextFormat, renderEpub,
  renderDocx, serializeMdi, parseMdiSyntax, MDI_SPEC_VERSION, MDI_IR_VERSION } from "@illusions-lab/mdi";
type MdiTextFormat = "txt" | "txt-ruby" | "narou" | "kakuyomu" | "aozora";
```

すべて complete source string を受け、内部で full parse します。JavaScript level に「一度 parse して複数形式を render」する API はまだありません。複数の renderer を同じ大きな文書に使うと、それぞれ Rust の `parse_document` を呼ぶ現在の実コストがあります。

## 入出力の型

`parse()` は `irVersion`、`syntaxVersion`、`capabilities`、`document`、`diagnostics` を持つ `MdiSyntaxParseResult` を返します。`document` と `diagnostics` の形は [Document IR](/ja/core/document-ir/) と [Diagnostics](/ja/core/diagnostics/) を参照してください。`renderEpub` と `renderDocx` は `Uint8Array` なので、Node.js では `fs.writeFile`、browser では `Blob` に渡してください。ほかはすべて `string` です。

## Diagnostic と error handling

`source` が string でない場合は `TypeError`、WASM と package の IR version が異なる場合は `Error` です。不正な MDI 記法自体は throw せず literal fallback になり、現在の diagnostic は [唯一の `mdi.version.unsupported`](/ja/core/diagnostics/) です。`try`/`catch` を diagnostics の代わりに使わないでください。

## IR version と UTF-8 byte span

`MDI_IR_VERSION` は現在 `"1.0"` です。`parse()` は package に組み込まれた定数と WASM の `irVersion` が違えば throw し、version が食い違う WASM を黙って解釈しません。`document` のすべての span は JavaScript string index ではなく UTF-8 **byte** offset です。`<textarea>` の selection などに使う前に [Diagnostics](/ja/core/diagnostics/#span) のように明示的に変換してください。

## 現在の実装状況

列挙した関数はすべて実装済みです。EPUB/DOCX は baseline（export-profile の cover/chapter split は未対応）です。

## この binding がしないこと

- **PDF はありません。** WASM は process を起動できないため、PDF には CLI または Node host の `@illusions-lab/mdi-to-pdf` を使います。
- **独自 grammar はありません。** CLI や Rust と意味が食い違えば `mdi-core` のバグです。
- **export profile を適用しません。** page size、font、margin はこの API の引数ではありません。`@illusions-lab/mdi-export-profile` と CLI の `--config` を使ってください。

## 次へ

- [Rust Core API](/ja/core/rust-api/)
- [Remark adapter](/ja/ecosystem/remark/)
- [CLI](/ja/bindings/cli/)
