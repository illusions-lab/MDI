---
title: HTML / TXT / EPUB / DOCX / PDF outputs
description: What each output format means, which package renders it, and where layout responsibility sits.
---

**Prerequisites:** [Rendering model and the Chromium/PDF boundary](/core/rendering/).

Every output below is a transformation of the **same** MDI document IR (see [Document IR](/core/document-ir/)) — none of them is a second syntax layer, and none of them re-decides what a piece of source text means. This page is the package-boundary view; [Rendering model](/core/rendering/) is the renderer-internals view of the same five outputs.

| Format | Package | What it actually is |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi` (`renderHtml`) | A standalone HTML document plus the embedded `.mdi-*` stylesheet |
| TXT (5 flavors) | `@illusions-lab/mdi` (`renderTextFormat`) / CLI | Plain, ruby-preserving, or a specific Japanese publishing platform's plain-text convention — see [TXT export flavors](/syntax/reference/#txt-export-flavors) |
| EPUB | `@illusions-lab/mdi` (`renderEpub`) | A real EPUB 3 archive: reflowable XHTML chapters + `nav.xhtml` + CSS + OPF package, zipped by Rust |
| DOCX | `@illusions-lab/mdi` (`renderDocx`) | A real OOXML (WordprocessingML) document, zipped by Rust |
| PDF | `@illusions-lab/mdi-to-pdf` | Rust-rendered HTML/print CSS, laid out and rasterized by a locally installed Chromium-family browser |

Four of these five are produced **entirely inside Rust** — the CLI and the JavaScript package call straight into `mdi-core`'s renderer functions with no intermediate JavaScript rendering step. PDF is the one exception, and only because generating a PDF requires launching an OS process (Chromium), which the Rust core itself does (via `render_pdf`/`find_chromium`) when called from a native host, and which the Node.js CLI reaches through `@illusions-lab/mdi-to-pdf`.

## Legacy compatibility packages

`@illusions-lab/mdi-to-hast`, `@illusions-lab/mdi-to-html`, `@illusions-lab/mdi-to-epub`, and `@illusions-lab/mdi-to-docx` still exist and are still published — they predate the current Rust-native renderers and operate on `mdast`/HAST trees instead of calling Rust's render functions directly. They remain useful for `unified`-ecosystem consumers who already have an `mdast` tree (via [the remark adapter](/ecosystem/remark/)) and want to render it without a second parse. **The CLI itself no longer uses them** for its own `build` command — see [Bindings: CLI](/bindings/cli/) for exactly which Rust function backs each `--to` value today. One concrete, current difference worth knowing: `@illusions-lab/mdi-to-hast`'s stylesheet matches `SYNTAX.md` more closely than the CSS Rust's own `render_html` embeds — see [Migration and compatibility: stylesheet parity](/ecosystem/compatibility/#stylesheet-parity).

## What's still pending across every renderer

Cover images, configurable chapter-split level, and full page-geometry/font control for EPUB and DOCX are not yet wired to an [export profile](/ecosystem/export-profiles/) — both renderers currently only read metadata (`title`/`author`/`lang`/`writing-mode`) straight from front matter. This is tracked explicitly on [Rust Core API status: not yet implemented](/core/rust-api/#not-yet-implemented), not silently absent.

## Next steps

- [Rendering model](/core/rendering/) — the Chromium/PDF boundary and EPUB/DOCX internals in detail.
- [Export profiles](/ecosystem/export-profiles/) — the exact per-format support table for profile settings.
- [Migration and compatibility](/ecosystem/compatibility/) — every current spec-vs-implementation gap in one place.
