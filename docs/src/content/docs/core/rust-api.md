---
title: Rust Core API status
description: Every public symbol actually in mdi-core/src/lib.rs today, with signatures — no speculative or aspirational entries.
---

**Prerequisites:** [Document IR](/core/document-ir/).

This page lists only symbols present in [`mdi-core/src/lib.rs`](https://github.com/illusions-lab/MDI/blob/main/mdi-core/src/lib.rs) as of this writing. It is a landing page, not generated `rustdoc` — automated `cargo doc` site integration is **Planned**; until then, the source file itself and this status page are the two reliable entry points. If they ever disagree, trust the source and treat this page as having a bug.

## Constants

- `MDI_SPEC_VERSION: &str = "2.0"` — the MDI syntax version this crate implements.
- `MDI_IR_VERSION: &str = "1.0"` — the wire-format version of `ParseOutput`/`Document`.
- `MDI_STYLESHEET: &str` — a minified CSS string embedded directly in `render_html`'s output. See [Ecosystem: Migration and compatibility](/ecosystem/compatibility/#stylesheet-parity) for how this differs from the CSS the `@illusions-lab/mdi-to-hast` package ships.

## Parsing

- `parse_document(source: &str) -> Document` — the primary entry point. Parses CommonMark, GFM, front matter, and MDI in one pass.
- `parse_output(source: &str) -> ParseOutput` — wraps `parse_document` in the versioned envelope (`irVersion`, `syntaxVersion`, `capabilities`, `document`, `diagnostics`).
- `parse_json(source: &str) -> String` — `parse_output`, serialized to a JSON string. This is the actual FFI boundary every binding crosses.
- `parse_inlines(source: &str) -> Vec<Inline>` — parses only MDI inline syntax from a string, ignoring block structure. Used internally and for focused inline-only testing.
- `parse_mdi_syntax(source: &str) -> MdiSyntaxDocument` — **deprecated compatibility helper.** Returns the older, simpler `MdiSyntaxDocument` shape described in [Document IR](/core/document-ir/#the-transitional-mdisyntaxdocument-shape). New code should use `parse_document` or `parse_output`.

## Serialization

- `serialize_mdi(source: &str) -> String` / `serialize_mdi_document(document: &Document) -> String` — canonical MDI/Markdown serialization. Round-trips a parsed document back to normalized `.mdi` source, applying the recommended-form normalization rules from `SYNTAX.md` (e.g. `《《text》》` → `[[em:text]]`).

## Rendering

- `render_html(source: &str) -> String` / `render_html_document(document: &Document) -> String` — standalone HTML document.
- `render_text(source: &str) -> String` / `render_text_document(document: &Document) -> String` — deterministic plain text (the `txt` flavor, hardcoded).
- `render_text_format(source: &str, format: TextFormat, indent_prefix: &str) -> String` — any of the six TXT flavors. `TextFormat` is `Plain | Ruby | Narou | Kakuyomu | Aozora | Note`, parsed from `txt`/`txt-ruby`/`narou`/`kakuyomu`/`aozora`/`note` via `TextFormat::parse`.
- `render_epub(source: &str) -> Result<Vec<u8>, String>` / `render_epub_document(document: &Document) -> Result<Vec<u8>, String>` — a complete EPUB 3 archive.
- `render_epub_with_profile(source: &str, profile_json: &str, cover: Option<&EpubCover>) -> Result<Vec<u8>, String>` / `render_epub_document_with_profile(...)` — configured EPUB metadata, typography, chapter splitting, and optional PNG/JPEG cover data.
- `render_docx(source: &str) -> Result<Vec<u8>, String>` / `render_docx_document(document: &Document) -> Result<Vec<u8>, String>` — a complete DOCX archive.
- `render_docx_with_profile(source: &str, profile_json: &str) -> Result<Vec<u8>, String>` / `render_docx_document_with_profile(...)` — configured OOXML page geometry, typography, grids, mirrored margins, and page numbering.
- `render_pdf(source: &str, options: &PdfOptions) -> Result<Vec<u8>, String>` — Rust-rendered HTML, laid out by a local Chromium. See [Rendering model: the Chromium/PDF boundary](/core/rendering/#the-chromiumpdf-boundary).
- `find_chromium() -> Option<PathBuf>` — best-effort search for a local Chromium-family executable, used when `PdfOptions.chromium_path` is `None`.

## Publication profiles

- `resolve_export_profile(...)` / `resolve_export_profile_json(...)` — validate and fill the canonical profile, optionally inheriting a document writing mode.
- `page_dimensions(page_size: &str) -> Option<(f64, f64)>` / `page_size_catalog_json() -> Result<String, String>` — the canonical 67-size physical paper catalogue used by bindings and renderers.
- `prepare_chromium_print_profile(...)` / its JSON and resolved variants — return styled HTML, millimetre page geometry, margins, and page-number templates for a Chromium host.
- `apply_pdf_profile(...)` / `apply_pdf_profile_json(...)` — apply the resolved print CSS without launching a browser.

## Public data types

`ParseOutput`, `ParserCapabilities`, `Diagnostic`, `DiagnosticSeverity`, `SourceSpan`, `Document`, `Frontmatter`, `FrontmatterEntry`, `PdfOptions`, `EpubCover`, `ResolvedExportProfile` and its nested profile/Chromium print types (current-generation API); `MdiSyntaxDocument`, `MdiBlock`, `PagebreakVariant`, `Inline`, `RubyReading` (the older, `parse_mdi_syntax`-only shape — `Inline`/`RubyReading` are also reused internally to build the current-generation `Document`'s MDI nodes, but their `serde` output is what appears inside `Document.children`, not `MdiSyntaxDocument`).

## Not yet implemented

These exist as concepts in `ARCHITECTURE.md`/`SYNTAX.md` but have **no corresponding function in `mdi-core` today** — don't assume they exist because the architecture diagram mentions the concept:

- A **standalone validation API** distinct from `parse_output`. Today, the only validation *is* whatever diagnostics `parse_output` returns as part of parsing; there's no separate `validate(document, options)` call.
- A **normalize** API distinct from `serialize_mdi`. Serialization already applies MDI's recommended-form normalization as a side effect of round-tripping; there's no separate function you'd call just to normalize without also serializing.

DOCX now emits native or portable OOXML representations for ruby, tate-chu-yoko, emphasis, kerning, page geometry, and other supported constructs. Word-compatible readers can still differ in Japanese line composition, so this is format support rather than a promise of pixel-identical browser layout.

## Next steps

- [Bindings: Rust](/bindings/rust/) — using these functions from a Rust project.
- [Document IR](/core/document-ir/) — the `Document`/`MdiSyntaxDocument` shapes these functions return.
- [Rendering model](/core/rendering/) — what each renderer function's output actually contains.
