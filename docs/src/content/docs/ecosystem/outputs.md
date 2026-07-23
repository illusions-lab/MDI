---
title: HTML / TXT / EPUB / DOCX / PDF outputs
description: What each output format means, which package renders it, and where layout responsibility sits.
---

**Prerequisites:** [Rendering model and the Chromium/PDF boundary](/core/rendering/).

Every output below is a transformation of the **same** MDI document IR (see [Document IR](/core/document-ir/)) — none of them is a second syntax layer, and none of them re-decides what a piece of source text means. This page is the package-boundary view; [Rendering model](/core/rendering/) is the renderer-internals view of the same five outputs.

| Format | Package | What it actually is |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi` (`renderHtml`) | A standalone HTML document plus the embedded `.mdi-*` stylesheet |
| TXT (6 flavors) | `@illusions-lab/mdi` (`renderTextFormat`) / CLI | Plain, ruby-preserving, or a specific Japanese publishing platform's plain-text convention — including [note export](/ecosystem/note/) |
| EPUB | `@illusions-lab/mdi` (`renderEpub`) | A real EPUB 3 archive: reflowable XHTML chapters + `nav.xhtml` + CSS + OPF package, zipped by Rust |
| DOCX | `@illusions-lab/mdi` (`renderDocx`) | A real OOXML (WordprocessingML) document, zipped by Rust |
| PDF | `@illusions-lab/mdi-to-pdf` | Rust-rendered HTML/print CSS, laid out and rasterized by a locally installed Chromium-family browser |

Four of these five are produced **entirely inside Rust**, including profile-configured EPUB and DOCX. The CLI and JavaScript package call straight into `mdi-core`; their JavaScript layers normalize arguments but do not render documents. PDF uses Rust-resolved profile data and Rust-prepared HTML/print CSS, then asks a native or Node host to launch Chromium.

## Legacy compatibility packages

`@illusions-lab/mdi-to-hast`, `@illusions-lab/mdi-to-html`, `@illusions-lab/mdi-to-epub`, and `@illusions-lab/mdi-to-docx` remain published for `unified` consumers that already hold an `mdast`/HAST tree. The EPUB and DOCX compatibility entries serialize that tree and delegate final generation to Rust; they no longer carry independent archive generators. **The CLI itself does not use these tree-facing entries** for `build`. One current difference worth knowing: `@illusions-lab/mdi-to-hast`'s stylesheet matches `SYNTAX.md` more closely than the CSS Rust's own `render_html` embeds — see [Migration and compatibility: stylesheet parity](/ecosystem/compatibility/#stylesheet-parity).

## Profile-configured output

Configured EPUB supports metadata, writing mode, typography, chapter splitting,
and PNG/JPEG cover images. Configured DOCX supports metadata, page geometry,
mirrored margins, writing mode, typography, strict or flowing grids, and page
numbers. Both routes resolve the same [export profile](/ecosystem/export-profiles/)
in Rust, so future Python, Swift, or Android APIs can expose the same behavior
without recreating it.

## Next steps

- [Rendering model](/core/rendering/) — the Chromium/PDF boundary and EPUB/DOCX internals in detail.
- [Export profiles](/ecosystem/export-profiles/) — the exact per-format support table for profile settings.
- [Migration and compatibility](/ecosystem/compatibility/) — every current spec-vs-implementation gap in one place.
