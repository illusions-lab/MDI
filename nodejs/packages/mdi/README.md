# `@illusions-lab/mdi`

The JavaScript interface to the Rust-authoritative MDI engine. Give it a
complete `.mdi` source document and it returns the versioned document IR and
diagnostics produced by `mdi-core`.

## Install

```sh
npm install @illusions-lab/mdi
```

```ts
import { parse } from "@illusions-lab/mdi";

const result = parse(`---
title: 短篇
---

# 第一章

第^12^話に[[em:傍点]]を付ける。`);

console.log(result.document);
console.log(result.diagnostics);
```

### Browser initialization

Browser applications must initialize the Rust WebAssembly module once before
using the otherwise synchronous APIs. Repeated calls return the same pending
initialization and are safe during hot reload or shared application startup:

```ts
import { initializeMdi, parse, serializeMdi } from "@illusions-lab/mdi";

await initializeMdi();
const parsed = parse("{東京|とうきょう} ^12^");
const canonical = serializeMdi("{東京|とうきょう} ^12^");
```

Vite and other browser-condition-aware bundlers select the web loader and emit
its WASM asset automatically. Node.js keeps its existing eager, synchronous
WASM loading behavior; `initializeMdi()` resolves immediately there, so shared
startup code can call it in both environments.

## What the binding does

The package has deliberately narrow responsibilities:

1. accept JavaScript strings, byte arrays, and options;
2. call `mdi-core` through the generated Rust binding;
3. check the returned IR schema version;
4. expose typed JavaScript objects, diagnostics, and renderer results.

It does not tokenize Markdown or MDI, repair malformed syntax, reinterpret
source spans, or maintain a JavaScript copy of the grammar. CommonMark, GFM,
front matter, MDI extensions, escapes, nesting, literal fallback, and all
syntax validation are decided by Rust.

```text
complete source
      ↓
JavaScript binding
      ↓
mdi-core parser
      ↓
versioned document IR + diagnostics
```

## Parse result

Every result carries the syntax version and IR schema version alongside the
document. Source-backed nodes use half-open UTF-8 byte spans. Recoverable
problems are returned as ordered diagnostics with stable codes, severity,
messages, and source spans.

Applications should treat the IR version as a wire-protocol version. They
must not infer grammar rules from object shapes or silently accept an
unsupported version.

## Searchable text blocks

`getMdiTextBlocks(source)` returns Rust-projected heading, paragraph, list,
blockquote, code, table, footnote, and HTML text in source order. Positions
such as `3:18` count one-based Unicode grapheme clusters; ruby readings are a
separate annotation channel anchored to the base-text range.

```ts
import { getMdiTextBlocks, resolveMdiSourceSpan, resolveMdiSourceSpans, sourceSpansForTextRange } from "@illusions-lab/mdi";

const result = getMdiTextBlocks("{東京|とうきょう}");
const block = result.blocks[0];
console.log(block.text); // 東京
console.log(block.annotations[0].anchor); // { start: "1:1", end: "1:3" }
console.log(sourceSpansForTextRange(block, { start: "1:1", end: "1:3" }));
console.log(resolveMdiSourceSpan("{東京|とうきょう}", { startByte: 1, endByte: 7 }));
console.log(resolveMdiSourceSpans("same same", [{ startByte: 0, endByte: 4 }, { startByte: 5, endByte: 9 }]));
```

`resolveMdiSourceSpan` accepts half-open UTF-8 byte offsets and returns ordered
`blockText` and `annotation` matches in canonical grapheme coordinates.
`coverage` is `complete`, `partial`, or `none`; each match is `exact` only when
its complete forward source coverage equals the requested span. Ruby base text
and readings are separate channels, and annotation indexes are zero-based.
Zero-width spans are valid and return no matches. Pure Markdown/MDI delimiters,
synthetic separators, and unmapped text do not acquire invented ranges, though
a delimiter token already owned by one projected grapheme (such as an explicit
break) can match. Reverse and forward mapping are therefore not generally
bijective, especially for annotations, multi-byte token mappings, partial
graphemes, discontinuous runs, and synthetic or unmapped text.
For multiple lookups against one document, use `resolveMdiSourceSpans`. It
validates the full array, performs one Rust parse/projection, and preserves
input order; repeated calls to the singular convenience API each parse anew.

Each source-derived grapheme is represented by a `sourceMap.runs` boundary;
table tabs/newlines and multi-paragraph joiners appear in `synthetic` and do
not receive invented source spans. `parseMdiTextPosition`,
`formatMdiTextPosition`, and `formatMdiTextRange` provide stateless coordinate
helpers.

## Rendering

Rendering starts from the same Rust IR. Canonical MDI, plain text, HTML, EPUB,
and DOCX—including profile-configured EPUB and DOCX—execute in Rust and are
exposed through this package. PDF uses Rust-prepared HTML, print CSS, page
geometry, and header/footer data as input to a host such as
`@illusions-lab/mdi-to-pdf`. The host launches Chromium, but it never parses
MDI or decides publication settings.

Browser WebAssembly cannot start Chromium. Browser code sends Rust-rendered
HTML to a server or desktop host when it needs PDF output.

### HTML, diagnostics, and host workflows

`renderHtml(source)` returns a standalone HTML document with the stable MDI
classes emitted by Rust. Pass `{ bodyOnly: true }` to embed its semantic body
in an application shell; this changes only the outer document wrapper, never
the MDI-to-HTML semantics.

```ts
import { renderHtmlWithDiagnostics } from "@illusions-lab/mdi";

const result = renderHtmlWithDiagnostics(source, { bodyOnly: true });
preview.replaceChildren(htmlToDom(result.output));
showDiagnostics(result.diagnostics); // stable codes and UTF-8 source spans
buildOutline(result.headings);       // source-backed heading nodes, not HTML scraping
```

For a parse-first flow, call `prepareRender(source)` (or `parse(source)`) and
display `diagnostics` before choosing an exporter. The public Rust ABI accepts
source text for renderer calls today, so renderers re-enter the same
Rust-authoritative parser rather than accepting mutable JavaScript IR. This
keeps the source spans and error codes predictable and prevents JavaScript from
becoming a second syntax implementation.

Configuration ownership is deliberately clear: Rust validates publication
profiles and applies EPUB/DOCX metadata, typography, page geometry, and
numbering. For PDF, Rust also prepares the print HTML and resolved page data;
the host owns only Chromium/Electron process control, printer integration, and
application UI preferences. This keeps layout behavior consistent without
putting application concerns into the parser.

### Configured EPUB and DOCX

For publication output, pass an export profile to the overloads (or use the
explicit `WithProfile` functions). The Promise-shaped API is retained for
compatibility, while profile validation and archive generation both run in
Rust. It supports metadata, chapter splitting, vertical writing, font
selection, paper size, margins, and page numbers. EPUB also accepts in-memory
PNG or JPEG cover art.

```ts
import { renderDocxWithProfile, renderEpubWithProfile } from "@illusions-lab/mdi";

const epub = await renderEpubWithProfile(source, {
  profile: {
    layout: { system: "japanese-publisher" },
    metadata: { title: "Book", author: "Author" },
    typesetting: { writingMode: "vertical", fontFamily: "Noto Serif JP" },
    epub: { chapterSplitLevel: "h1" },
  },
  cover: { data: coverBytes, mediaType: "image/png" },
});

const docx = await renderDocxWithProfile(source, {
  layout: { system: "word" },
  pagination: { pageSize: "A5", margins: { top: 12, bottom: 12, left: 14, right: 14 } },
});
```

`renderEpub(source)` and `renderDocx(source)` remain synchronous,
backward-compatible Rust baseline exports. `renderEpub(source, options)` and
`renderDocx(source, profile)` are equivalent async overloads for configured
publication output.

## Remark compatibility

Remark support is an optional adapter between Rust IR and mdast. It exists for
applications that need unified plugins:

```text
source → mdi-core → Rust IR ⇄ mdast → unified plugins
```

The adapter contains no tokenizer, grammar, or syntax fallback. When an mdast
pipeline needs MDI output, it is converted back to Rust IR and Rust performs
validation and serialization.

The normative human-readable syntax is defined in
[`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md). The
executable syntax authority is `mdi-core`.

## Documentation

- [JavaScript binding guide](https://mdi.illusions.app/bindings/javascript/)
- [Document IR and diagnostics](https://mdi.illusions.app/core/document-ir/)
- [Rendering model](https://mdi.illusions.app/core/rendering/)
- [JavaScript documentation](https://mdi.illusions.app/bindings/javascript/)
