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

## Rendering

Rendering starts from the same Rust IR. Canonical MDI, plain text, HTML, EPUB,
and DOCX renderers execute in Rust and are exposed through this package. PDF
uses Rust HTML as its input to a host layout adapter such as
`@illusions-lab/mdi-to-pdf`; the adapter may control Chromium, but it never
parses MDI or produces semantic HTML.

Browser WebAssembly cannot start Chromium. Browser code sends Rust-rendered
HTML to a server or desktop host when it needs PDF output.

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
