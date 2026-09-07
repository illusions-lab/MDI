---
title: JavaScript / TypeScript
description: "Use Rust-owned MDI semantics from JavaScript, then choose a baseline or configured export."
---

**Prerequisites:** [Getting Started](/guides/getting-started/) and [Document IR](/core/document-ir/).

## Install and parse first

```bash
npm install @illusions-lab/mdi
```

The package runs the MDI parser in prebuilt WebAssembly. It works in Node.js and bundlers with WASM support; it does not need a native build on the consumer machine. Parse before an export UI makes a warning visible instead of silently rendering through it:

```ts
import { parse, renderHtmlWithDiagnostics } from "@illusions-lab/mdi";

const source = "# 第一章\n{東京|とうきょう}は雨だった。";
const parsed = parse(source);
if (parsed.diagnostics.some((item) => item.severity === "error")) {
  // Use item.code and its UTF-8 byte span to mark the editor.
}

const html = renderHtmlWithDiagnostics(source, { bodyOnly: true });
console.log(html.output);    // semantic contents of <body>
console.log(html.headings);  // source-order heading text, depth, and spans
```

`parse()` returns Rust-owned `document`, `diagnostics`, and UTF-8-byte source spans. Malformed inline notation normally uses its literal fallback rather than throwing; see [Diagnostics](/core/diagnostics/) for the complete warning list. `prepareRender(source)` is the same parse-first convenience for a host workflow. The `*WithDiagnostics` helpers return that parser result alongside output; they do not make an invalid document fail automatically.

`renderHtml(source)` returns a standalone document with the MDI stylesheet. Pass `{ bodyOnly: true }` when the application owns the outer page. `renderHtmlWithDiagnostics` also exposes headings, so navigation and chapter controls need not scrape generated HTML. The stable MDI classes (`mdi-ruby`, `mdi-tcy`, `mdi-em`, `mdi-pagebreak`, and related classes) are part of that semantic HTML.

## Browser initialization

In a browser, await the WebAssembly runtime once before calling the synchronous
API. `initializeMdi()` is single-flight and idempotent: concurrent calls share
one initialization, and Node.js resolves it immediately because its runtime is
loaded eagerly.

```ts
import { initializeMdi, parse, serializeMdi } from "@illusions-lab/mdi";

await initializeMdi();
const parsed = parse("{東京|とうきょう} ^12^");
const canonical = serializeMdi("{東京|とうきょう} ^12^");
```

Vite and other bundlers that honor the `browser` export condition select the
web facade and emit its private WASM asset automatically. Do not import the
generated wasm-pack loader directly. A failed browser initialization can be
retried safely by calling `initializeMdi()` again.

## Build a plaintext search index

`getMdiTextBlocks(source)` parses once in Rust and returns source-order text
blocks alongside the complete document IR and diagnostics. A position such as
`3:18` means the eighteenth one-based Unicode grapheme in the third block.
Ruby readings remain searchable annotations whose `anchor` points back to the
base-text range.

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

`sourceMap.synthetic` identifies separators added by the projection, such as
table tabs and row newlines; these deliberately produce no source span.
`parseMdiTextPosition`, `formatMdiTextPosition`, and `formatMdiTextRange` are
stateless helpers for the canonical coordinate spelling.

`resolveMdiSourceSpan(source, span)` performs the inverse lookup in Rust. The
span is half-open UTF-8 bytes and must use uint32 values in source order, stay
within the source, and end on code-point boundaries. It returns ordered
`blockText` and zero-based `annotation` matches plus `complete`, `partial`, or
`none` coverage. Ruby base/readings are independent channels. A match is
`exact` only when its full forward coverage equals the input; otherwise it is
`overlap`. Empty spans return no caret-like neighbor. Structural delimiters,
synthetic separators, and unmapped text produce no invented canonical range,
so forward/reverse mapping is not promised to be bijective across annotations,
multi-to-one tokens, partial graphemes, discontinuities, or unmapped text.

Use `resolveMdiSourceSpans(source, spans)` for diagnostics or decoration
batches. Rust validates all spans, parses/projects the document once, and
returns one resolution per input span in the same order. Each separate call to
the singular convenience API performs its own parse.

## Choose the export level

The one-argument EPUB and DOCX calls are synchronous Rust baseline exports:

```ts
import { renderEpub, renderDocx } from "@illusions-lab/mdi";
import { writeFile } from "node:fs/promises";

await writeFile("book.epub", renderEpub(source));
await writeFile("book.docx", renderDocx(source));
```

Use the two-argument overloads (or their explicit `WithProfile` names) for a publication export. Their Promise-shaped API is kept for compatibility, while profile validation and EPUB/DOCX generation run in Rust. JavaScript neither reparses MDI nor keeps another document generator.

```ts
import { renderEpub, renderDocx } from "@illusions-lab/mdi";

const epub = await renderEpub(source, {
  profile: { layout: { system: "japanese-publisher" } },
  title: "雨の東京",
  author: "Illusions",
  language: "ja",
  publisher: "Illusions Lab",
  identifier: "urn:isbn:example",
  date: "2026-07-21",
  verticalWriting: true,
  fontFamily: "Yu Mincho",
  textIndent: 1,
  chapterSplitLevel: "h1",
  coverImage: coverBytes,
  coverMediaType: "image/png",
});

const docx = await renderDocx(source, {
  layout: { system: "word" },
  title: "雨の東京",
  author: "Illusions",
  verticalWriting: true,
  fontFamily: "Yu Mincho",
  fontSize: 11,
  lineSpacing: 1.6,
  textIndent: 1,
  pagination: { gridMode: "typographic" },
  pageSize: "A5",
  landscape: false,
  margins: { top: 18, right: 15, bottom: 18, left: 15 },
  showPageNumbers: true,
  pageNumberPosition: "bottom-center",
  pageNumberFormat: "simple",
});
```

Both configured calls also accept the full nested `ExportProfile` schema through `profile` (EPUB) or directly (DOCX). The short fields above are aliases: EPUB supports metadata, writing direction, typeface, indent, chapter split, and a PNG/JPEG `Uint8Array` cover; DOCX supports metadata, direction, page size/orientation/margins, typeface/size/line spacing/indent, and page numbering (`simple`, `dash`, or `fraction`). See [Export profiles](/ecosystem/export-profiles/) for the complete JSON shape.

Every configured export must state `layout.system`. Choose `"japanese-publisher"` for a mirrored Japanese book: horizontal text defaults to 10 pt Mincho on `Shirokuban`, with a strict 27-character × 26-line left-bound grid; vertical text defaults to the A4-landscape novel manuscript, a strict 40-character × 30-line right-bound grid. Choose `"word"` for Word-style flowing pages: its default is A4 with 25.4 mm on every side, no mirror margins, and `gridMode: "typographic"`; `"word"` rejects `"strict"`.

## Where each responsibility lives

Rust owns parsing, diagnostics, source spans, profile validation, the canonical paper catalogue, and configured EPUB/DOCX generation. For PDF, Rust prepares the styled HTML, page geometry, and page-number templates; the host only controls Chromium and application UI. The configured DOCX exporter represents page breaks, vertical text, ordinary paragraph formatting, ruby/tate-chu-yoko/no-break/kern/blank constructs as far as OOXML permits, but it is not a byte-for-byte visual equivalent of browser HTML. Test the generated DOCX in the Word-compatible reader your users rely on when those Japanese composition details are critical.

## HTML and PDF hosts

PDF is deliberately in the Node-only entry point, so browser bundles do not acquire a browser launcher:

```ts
import { preparePdfExport, renderPdfWithChromium } from "@illusions-lab/mdi/node";

// Electron can take this HTML and call its own print-to-PDF API.
const request = preparePdfExport(source, profile);

// Node uses @illusions-lab/mdi-to-pdf when it is installed.
const pdf = await renderPdfWithChromium(source, profile);
```

Install `@illusions-lab/mdi-to-pdf` alongside `@illusions-lab/mdi` for the default Node/Playwright host. An Electron host may instead pass `{ renderHtmlToPdf(html, profile, sourceWritingMode) }` to `renderPdfWithChromium`. Rust resolves PDF paper, landscape, margins, writing direction, font, font size/line spacing, character/line grids, indentation, and page-number settings. Browser/WASM consumers can create configured EPUB/DOCX locally; PDF alone must send `preparePdfExport()` to a Node, Electron, Tauri, or CLI host that can launch Chromium.

## Other exports and errors

`renderText`, `renderTextFormat`, and `serializeMdi` are synchronous Rust functions. `renderTextFormat` accepts `txt`, `txt-ruby`, `narou`, `kakuyomu`, `aozora`, or `note` plus an optional indentation prefix. `parseMdiSyntax` is a deprecated alias for `parse`; `MDI_SPEC_VERSION` is `"2.0"` and `MDI_IR_VERSION` is `"1.0"`.

Non-string source is a `TypeError`; invalid option objects are also rejected with `TypeError`. Treat diagnostics as document feedback, and reserve `try`/`catch` for programming, I/O, archive, or host-renderer failures. Source spans are UTF-8 **byte** offsets, not JavaScript string indices; see [Diagnostics](/core/diagnostics/).


### Automatic warichu layout

Automatic warichu uses two lines at 50% type. Use `layoutMdiWarichu(children, { firstCapacity, continuationCapacity })` for Rust splitting, `attachMdiWarichuLayout(container)` for read-only HTML, and `settleMdiPrintLayout(evaluate, { timeoutMs, signal, page: prepared.page })` before printing. Layout is presentation-only; canonical MDI is unchanged. Static EPUB/HTML preserve readable precomputed lines; reader reflow may vary.
