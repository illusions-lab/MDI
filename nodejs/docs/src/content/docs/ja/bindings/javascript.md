---
title: JavaScript / TypeScript
description: Rust-backed JavaScript API @illusions-lab/mdi。
---

**前提:** [Getting Started](/ja/guides/getting-started/)、[Document IR](/ja/core/document-ir/)。

`@illusions-lab/mdi` は `mdi-core` を WebAssembly に compile した binding です。JavaScript 側に MDI grammar の再実装はありません。

## Install

```bash
npm install @illusions-lab/mdi
```

Node.js および WASM import を扱える bundler で動き、WASM binary は package に同梱されます。

## 最小例

```ts
import { parse, renderHtml } from "@illusions-lab/mdi";
const source = "第^12^話。{東京|とうきょう}は雨だった。";
const result = parse(source);
console.log(result.syntaxVersion, result.irVersion); // "2.0" "1.0"
console.log(renderHtml(source));
```

## Export

```ts
import { parse, renderHtml, renderText, renderTextFormat, renderEpub,
  renderDocx, serializeMdi, parseMdiSyntax, MDI_SPEC_VERSION, MDI_IR_VERSION } from "@illusions-lab/mdi";
type MdiTextFormat = "txt" | "txt-ruby" | "narou" | "kakuyomu" | "aozora";
```

すべて complete source string を受け、内部で full parse します。JavaScript level に「一度 parse して複数形式を render」する API はまだありません。`renderEpub` と `renderDocx` は `Uint8Array`、他は string を返します。

## Error と diagnostic

`source` が string でない場合は `TypeError`、WASM と package の IR version が異なる場合は `Error` です。不正な MDI 記法自体は throw せず literal fallback になり、現在の diagnostic は [唯一の `mdi.version.unsupported`](/ja/core/diagnostics/) です。span は UTF-8 byte offset です。

## 実装状況と非対応

列挙した関数はすべて実装済みです。EPUB/DOCX は baseline（export-profile の cover/chapter split は未対応）です。PDF API はありません。WASM は process を起動できないため、PDF には CLI または Node host の `@illusions-lab/mdi-to-pdf` を使います。export profile もこの API の引数ではありません。

## 次へ

- [Rust Core API](/ja/core/rust-api/)
- [Remark adapter](/ja/ecosystem/remark/)
- [CLI](/ja/bindings/cli/)
