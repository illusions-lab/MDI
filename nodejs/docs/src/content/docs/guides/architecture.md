---
title: Architecture
description: Rust as the single syntax authority, thin language bindings, and shared renderers.
---

## One parser, many interfaces

Rust owns the complete meaning of an `.mdi` document. `mdi-core` parses
CommonMark, GFM, front matter, and MDI extensions together and returns one
versioned, language-neutral document IR.

```text
.mdi source
    ↓
mdi-core → MDI document IR → Rust renderers
    │                │              ├─ MDI / TXT / HTML / EPUB / DOCX
    │                │              └─ HTML/CSS → Chromium → PDF
    │                └─ mdast/remark adapter
    └─ JavaScript / Python / Swift bindings
```

Language bindings only convert strings, byte arrays, errors, options, and
object shapes. They do not recognize or validate syntax. Ruby grouping,
escapes, valid `kern` amounts, and nested macro boundaries are implemented in
Rust only.

The human-readable [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md),
the Rust parser, and shared conformance fixtures define the public contract.

:::caution Current implementation status
This page describes the product contract. The current Rust surface is listed
in [Rust Core API status](/core/rust-api/); the Node CLI and output packages
still use a transitional TypeScript mdast/HAST path. That path is not a second
syntax authority.
:::

## Why Rust parses the whole document

MDI boundaries depend on Markdown context:

```markdown
`^12^`                 <!-- literal inside code -->
**第^12^話**           <!-- MDI inside strong text -->
[[em:**重要**]]        <!-- Markdown inside an MDI construct -->
```

CommonMark, GFM, front matter, and MDI must therefore be one Rust-owned grammar
and one syntax tree. A host Markdown parser is never required by the primary
API.

## Document contract

Every parse result contains:

- syntax and IR schema versions;
- typed CommonMark, GFM, front-matter, and MDI nodes;
- half-open UTF-8 byte spans for source-backed nodes;
- ordered front matter, including unknown keys;
- recoverable diagnostics with stable codes and source spans.

Malformed MDI follows the literal-fallback rules in the syntax specification
and may emit diagnostics. Code spans, fenced code, and raw contexts keep
MDI-looking text literal.

## Renderers

The product contract places canonical MDI, text flavors, HTML, EPUB, and DOCX
rendering in Rust from the same IR. The current Node output packages are the
transitional implementation; see [outputs](/ecosystem/outputs/) for status.

PDF uses Chromium deliberately. Rust renders HTML and print CSS, starts an
isolated Chromium process, communicates over the Chrome DevTools Protocol,
calls `printToPDF`, and returns the bytes. Chromium handles Japanese vertical
layout, ruby, tate-chu-yoko, emphasis, font shaping, and pagination; it never
parses MDI.

Browser WebAssembly cannot launch Chromium, so browser applications call a
server or desktop host for the PDF operation.

## JavaScript and remark

`@illusions-lab/mdi` is a thin JavaScript interface to `mdi-core`. Its primary
entry point sends the complete source to Rust and returns the versioned IR and
diagnostics.

Remark is optional compatibility infrastructure. Its adapter converts between
the Rust IR and mdast so existing unified plugins can participate in a
pipeline. It contains no tokenizer, grammar rule, validation logic, or syntax
fallback. Converting mdast back to MDI first produces Rust IR; Rust then
validates and serializes the document.

See the repository
[`ARCHITECTURE.md`](https://github.com/illusions-lab/MDI/blob/main/ARCHITECTURE.md)
for the complete API, IR, rendering, binding, and compliance contract.

## Versioning

Package versions are `<MDI spec version>.<release>`: major.minor identifies the
implemented MDI specification and patch is each package's release counter,
starting at `.1`.
