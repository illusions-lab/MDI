---
title: Architecture
description: How the nine mdi-js packages fit together, and why the pipeline splits where it does.
---

## Package layers

| Package | Layer | Role |
|---------|-------|------|
| `micromark-extension-mdi` | Parser core | Tokenizes MDI inline/block syntax on top of CommonMark. |
| `mdast-util-mdi` | Parser core | Compiles the token events into mdast nodes, and serializes them back to markdown. |
| `@illusions-lab/mdi-remark` | Parser core | One remark plugin bundling GFM + YAML front matter + the MDI extensions. The recommended entry point. |
| `@illusions-lab/mdi-to-hast` | Shared transform | Maps MDI mdast nodes to hast per the spec's HTML mapping. Exports the handler table (`mdiHandlers`) and the stylesheet. |
| `@illusions-lab/mdi-to-html` | Converter | hast → complete HTML document string, stylesheet inlined. |
| `@illusions-lab/mdi-to-pdf` | Converter | Renders the HTML in headless Chromium and prints to PDF. |
| `@illusions-lab/mdi-to-epub` | Converter | hast → EPUB 3 (XHTML, OPF manifest, nav; spine split on page breaks). |
| `@illusions-lab/mdi-to-docx` | Converter | mdast → native OOXML, bypassing hast entirely. |
| `@illusions-lab/mdi-cli` | CLI | `mdi build input.mdi --to html\|pdf\|epub\|docx` — thin wrapper over the converters. |

## The pipeline

```
micromark-extension-mdi ─▶ mdast-util-mdi ─▶ @illusions-lab/mdi-remark
                                  │
                                  ▼  (one mdast tree)
                        @illusions-lab/mdi-to-hast ────────┐
                            │              │               │
                            ▼              ▼               │
                       mdi-to-html    mdi-to-epub          │
                            │                              │
                            ▼                              ▼
                       mdi-to-pdf                    mdi-to-docx
                                                (reads mdast directly)
```

Every converter consumes the **same mdast tree** produced by
`@illusions-lab/mdi-remark`, so editor-path and export-path behavior stay in
sync (see the spec's
[Parsing Order](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md#parsing-order--パース順序)).

## Why the split falls where it does

**Three of the four output formats are HTML-family.** HTML, PDF (printed from
a browser), and EPUB (zipped XHTML) all want the same mdast → hast mapping, so
that mapping lives once in `@illusions-lab/mdi-to-hast` and the three
converters stay thin.

**PDF goes through a real browser on purpose.** Japanese typography features —
`writing-mode: vertical-rl`, `text-combine-upright` (tate-chu-yoko),
`text-emphasis` (boten) — are exactly the CSS that lightweight HTML-to-PDF
libraries get wrong. Headless Chromium renders them correctly, so
`mdi-to-pdf` is deliberately just "open the HTML, print it."

**DOCX is not HTML-family.** Word has native constructs for the same concepts
(`<w:ruby>`, `<w:eastAsianLayout w:combine="1"/>`, section-level vertical text
direction), and mapping hast onto those would mean un-flattening HTML back
into semantics we already had. So `mdi-to-docx` reads the mdast tree directly.

**The parser core is three packages, not one,** following the micromark/mdast
ecosystem convention: the tokenizer and the mdast utility are usable on their
own in any unified pipeline (this documentation site uses exactly those two
plus `mdiHandlers` — no converter involved), while `@illusions-lab/mdi-remark`
is the batteries-included plugin for applications.

## Rust syntax core and the JavaScript-first release

The canonical MDI grammar lives in the separate
[`illusions-lab/MDI`](https://github.com/illusions-lab/MDI) specification
repository. This repository keeps its existing `mdi-js` name and JavaScript
public API.

`crates/mdi-core` is a language-neutral Rust implementation of the
MDI-specific grammar: escapes, grapheme-aware ruby, tate-chu-yoko, boten,
nestable inline macros, and MDI block macros. It intentionally does **not**
parse CommonMark or GFM; those stay with micromark/remark in the JavaScript
adapter. This preserves the established mdast API and means every existing JS
consumer keeps its behavior.

The first release containing the Rust core is JavaScript-first: the core is
verified with Cargo alongside the existing JavaScript suite, while the
published API remains the current micromark/remark pipeline. Native Node,
Python, and WASM bindings are follow-up adapters over the same core, not new
parsers with independent grammars.

## Versioning

Package versions are `<MDI spec version>.<release>` — major.minor always
equals the targeted MDI spec version (currently **2.0**), and the patch number
is each package's own release counter starting at `.1`. So `2.0.5` means "5th
release targeting MDI 2.0," and patch numbers are not synchronized across
packages.
