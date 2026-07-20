---
title: JavaScript / TypeScript
description: @illusions-lab/mdi — the primary, Rust-backed JavaScript API, with every exported function and its real behavior.
---

**Prerequisites:** [Getting Started](/guides/getting-started/), [Document IR](/core/document-ir/).

## What this binding solves

You need to parse or render `.mdi` documents from Node.js, a bundler-based web app, or any other JavaScript/TypeScript environment, without shelling out to a CLI. `@illusions-lab/mdi` compiles `mdi-core` to WebAssembly and exposes it as ordinary typed functions — there is no JavaScript-side reimplementation of any MDI grammar rule anywhere in this package.

## Install

```bash
npm install @illusions-lab/mdi
```

Works in Node.js and in any bundler that supports WASM imports (Vite, Webpack 5+, esbuild with a WASM loader). It does not require a native build step on the consumer's machine — the WASM binary ships prebuilt inside the npm package.

## Minimal executable example

```ts
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = "第^12^話。{東京|とうきょう}は雨だった。";

const result = parse(source);
console.log(result.syntaxVersion, result.irVersion); // "2.0" "1.0"
console.log(result.document.children.length);        // 1 (one paragraph)
console.log(result.diagnostics);                      // []

console.log(renderHtml(source));
// <!DOCTYPE html><html lang="ja"><head>...<body><p><span class="mdi-tcy">12</span>話。<ruby class="mdi-ruby">東京<rp>（</rp><rt>とうきょう</rt><rp>）</rp></ruby>は雨だった。</p></body></html>
```

## Every exported function

```ts
import {
  parse,             // (source: string) => MdiSyntaxParseResult
  renderHtml,        // (source: string) => string
  renderText,        // (source: string) => string  — the plain "txt" flavor
  renderTextFormat,  // (source: string, format: MdiTextFormat, indentPrefix?: string) => string
  renderEpub,        // (source: string) => Uint8Array
  renderDocx,        // (source: string) => Uint8Array
  serializeMdi,      // (source: string) => string  — canonical MDI round-trip
  parseMdiSyntax,     // deprecated alias for `parse`
  MDI_SPEC_VERSION,   // "2.0"
  MDI_IR_VERSION,     // "1.0"
} from "@illusions-lab/mdi";

type MdiTextFormat = "txt" | "txt-ruby" | "narou" | "kakuyomu" | "aozora";
```

Every function takes the **complete** source string and does its own full parse internally — there is no separate "parse once, render many times without reparsing" call at the JavaScript level today; each render function calls into Rust's own `parse_document` again. This is a real, current cost if you call several render functions on the same large source and care about parse time, not a documented long-term guarantee.

## Input and output types

```ts
interface MdiSyntaxParseResult {
  irVersion: "1.0";
  syntaxVersion: "2.0";
  capabilities: { mdi: boolean; commonMark: boolean; gfm: boolean; frontMatter: boolean; sourceSpans: boolean };
  document: MdiDocument;       // see /core/document-ir/
  diagnostics: MdiDiagnostic[]; // see /core/diagnostics/
}
```

`renderEpub`/`renderDocx` return `Uint8Array` — write them to a file (`fs.writeFile`) or hand them to a `Blob` in a browser; they are not strings and must not be decoded as UTF-8 text. Every other function returns a plain `string`.

## Diagnostics and error handling

`parse` almost never throws. It validates that `source` is a string (`TypeError: source must be a string` otherwise) and that the WASM module's `irVersion` matches the constant this package was built against (`Error: Unsupported MDI IR version: ...` — this would only happen from a version-mismatched WASM binary, not from anything in your `.mdi` source). Malformed *MDI syntax itself* never throws — it's represented in the returned tree via each construct's literal-fallback rule, with `diagnostics` reporting only the one currently-implemented case (`mdi.version.unsupported`; see [Diagnostics](/core/diagnostics/)).

```ts
try {
  parse(42 as unknown as string);
} catch (error) {
  console.error(error); // TypeError: source must be a string
}
```

Reserve `try`/`catch` for these programming-error cases. Do not wrap `parse` in `try`/`catch` as a substitute for checking `diagnostics` — a `.mdi` file with typos in it is expected to parse successfully with fallback text, not throw.

## IR version and UTF-8 byte spans

`MDI_IR_VERSION` is `"1.0"` today. `parse` throws if the WASM module ever returns a different `irVersion` than the constant baked into the JS package at build time — this is what prevents a version-skewed WASM binary from being silently misinterpreted. Every span in `document` (see [Document IR](/core/document-ir/)) is a UTF-8 **byte** offset, not a JavaScript string index; see [Diagnostics and UTF-8 source spans](/core/diagnostics/#spans-precisely) for the exact conversion you need before using a span with a JS string or a `<textarea>` selection.

## Current implementation status

Every function listed above is real and calls Rust directly — none of it is a stub. What's still evolving: `renderEpub`/`renderDocx` are the same "baseline" implementations described in [Rendering model](/core/rendering/#epub-and-docx-what-baseline-means-concretely) (no export-profile cover/chapter-split support yet), and there is no PDF function in this package — PDF requires launching a process, which WASM cannot do (see below).

## What this binding doesn't do

- **No PDF.** `@illusions-lab/mdi` cannot launch Chromium — WASM has no process-spawn capability. Use `@illusions-lab/mdi-cli` or `@illusions-lab/mdi-to-pdf` (a thin wrapper that calls Rust's `render_pdf` from a Node.js host that *can* spawn a process) for PDF.
- **No grammar of its own.** If you ever find this package disagreeing with the CLI or with Rust directly about what a piece of text means, that is a bug — file it against `mdi-core`, since this package has no independent parsing logic to fix.
- **No export-profile application.** Passing page size, fonts, or margins is not part of this package's API; that's `@illusions-lab/mdi-export-profile` plus the CLI's `--config` flag — see [Export profiles](/ecosystem/export-profiles/).

## Next steps

- [Rust Core API status](/core/rust-api/) — the exact Rust functions this package wraps.
- [Ecosystem: Remark / mdast adapter](/ecosystem/remark/) — using this package's `parse()` from a `unified` pipeline.
- [Bindings: CLI](/bindings/cli/) — the same functions, from the command line.
