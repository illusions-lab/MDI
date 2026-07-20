---
title: Rust-authoritative architecture
description: One executable grammar, one versioned IR, and thin host-language interfaces — with the exact rule that makes it enforceable.
---

**Prerequisites:** [Core concepts](/learn/core-concepts/).

## The rule

**No binding, adapter, editor, or renderer other than `mdi-core` may contain a second copy of MDI's grammar.** Not a duplicate tokenizer, not a "fallback" regex for when the WASM module isn't loaded, not a per-language reimplementation kept "in sync" by hand. If two tools ever parsed the same `.mdi` source differently, that would be a bug in one of them, by definition — there's only supposed to be one place that gets to decide.

This is stricter than "Rust is the reference implementation." A reference implementation other tools are allowed to reimplement and drift from over time. MDI's contract is that other tools **call into** the one implementation, or reshape its output — never duplicate its decisions.

## Two complementary authorities

1. [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) — the normative, human-readable specification. It's what you read to understand *why* a rule exists.
2. `mdi-core` — the only *executable* implementation of that specification. It's what actually runs.
3. Shared conformance fixtures (parser/diagnostic/renderer test cases run identically across bindings) are the observable compatibility contract between the two — they exist so "matches the spec" is something you can run, not just something you can argue about.

## System shape

```text
                               .mdi source
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │ mdi-core (Rust)             │
                    │ CommonMark + GFM + MDI      │
                    │ + front matter + diagnostics│
                    └──────────────┬──────────────┘
                                   │
                         versioned MDI document IR
                                   │
             ┌─────────────────────┼──────────────────────┐
             │                     │                      │
             ▼                     ▼                      ▼
      Rust renderers        language bindings      ecosystem adapters
      HTML/TXT/EPUB/DOCX/MDI  JavaScript (real)      mdast/remark (real)
                              Python (real)
                              Swift (Planned)
             │
             └── HTML + print CSS ──▶ Chromium ──▶ PDF
```

Every arrow above is a real, checkable relationship today except the one marked Planned. `@illusions-lab/mdi` (JavaScript), `illusion-markdown` (Python, on PyPI), and `@illusions-lab/mdi-remark` all call the same Rust code — see [Bindings: JavaScript / TypeScript](/bindings/javascript/), [Bindings: Python](/bindings/python/), and [Ecosystem: Remark / mdast adapter](/ecosystem/remark/) for the exact call sites.

## Why one pass, not one pass per layer

MDI cannot be parsed as an independent layer stacked on top of a separately-parsed Markdown tree, because MDI boundaries depend on Markdown context that only a single combined parser can see:

```markdown
`^12^`                 <!-- inside a code span: literal, not tate-chu-yoko -->
**第^12^話**            <!-- inside strong emphasis: tate-chu-yoko still applies -->
[[em:**重要**]]        <!-- Markdown emphasis nested inside an MDI macro -->
```

A two-pass design (first Markdown, then MDI on the result, or vice versa) would have to re-derive these boundaries and risk disagreeing with the single-pass Rust parser about edge cases like the three lines above. `mdi-core` avoids the problem by parsing CommonMark, GFM, front matter, and MDI in one pass, into one tree.

## What a binding is allowed to do

A binding may convert strings, bytes, errors, options, and object shapes between Rust's wire format and its host language's idioms. It may **not** add grammar tables, tokenizers, literal-fallback rules, or renderer semantics of its own. Concretely, `@illusions-lab/mdi`'s `parse()` function is a thin wrapper: it calls the WASM-compiled Rust parser, checks the IR version, and returns the result — [read the actual ~140-line source](https://github.com/illusions-lab/MDI/blob/main/nodejs/packages/mdi/src/index.ts) to see that there's no MDI-specific decision logic in it at all.

## Compliance checklist

An implementation is part of MDI only if all of the following hold:

- Every syntax entry point delegates the complete source to `mdi-core`.
- All public parse results declare their syntax and IR versions.
- Every binding passes the shared parse and diagnostic fixtures unchanged.
- Every deterministic renderer consumes the Rust IR — never re-reads source text.
- PDF output uses HTML/CSS produced from the Rust IR, orchestrated by Rust.
- No host-language package contains an alternative MDI tokenizer or parser.

## Current implementation status vs. Planned

| Layer | Status |
| --- | --- |
| `mdi-core`: full CommonMark + GFM + front matter + MDI in one Rust parse | **Implemented.** See [Rust Core API status](/core/rust-api/) for the exact function list. |
| Rust-native `renderHtml`/`renderText`/`renderEpub`/`renderDocx` | **Implemented** (baseline). Cover media, detailed DOCX typography, and full export-profile/pagination parity are later extensions of these same APIs, not separate milestones. |
| Rust-orchestrated PDF via Chromium | **Implemented.** See [Rendering model](/core/rendering/#the-chromiumpdf-boundary). |
| `@illusions-lab/mdi` (JavaScript/WASM) | **Implemented** — calls Rust directly for every operation; see [Bindings: JavaScript](/bindings/javascript/). |
| `@illusions-lab/mdi-remark` (mdast adapter) | **Implemented** as a one-way adapter (MDI → mdast); see [Ecosystem: Remark](/ecosystem/remark/) for exactly what "one-way" means today. |
| `@illusions-lab/mdi-cli` | **Implemented**, calling Rust directly for every format except the final Chromium print step; see [Bindings: CLI](/bindings/cli/). |
| Python binding (PyO3) | **Implemented.** Published on PyPI as [`illusion-markdown`](https://pypi.org/project/illusion-markdown/) (import name `mdi`); calls the same Rust core directly. See [Bindings: Python](/bindings/python/). |
| Swift binding (UniFFI/C ABI) | **Planned.** [`swift/README.md`](https://github.com/illusions-lab/MDI/blob/main/swift/README.md) currently says "not yet implemented," in those words. See [Bindings: Swift](/bindings/swift/). |

The repository's [`ARCHITECTURE.md`](https://github.com/illusions-lab/MDI/blob/main/ARCHITECTURE.md) is the normative version of this contract; this page explains and status-checks it.

## Next steps

- [Document IR](/core/document-ir/) — what actually comes out of `mdi-core`.
- [Rust Core API status](/core/rust-api/) — the exact function signatures available today.
- [Rendering model and the Chromium/PDF boundary](/core/rendering/) — how the IR becomes HTML, EPUB, DOCX, and PDF.
