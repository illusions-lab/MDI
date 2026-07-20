---
title: Rust Core API の状況
description: 現在 mdi-core/src/lib.rs に実在する public symbol の一覧。
---

**前提:** [Document IR](/ja/core/document-ir/)。このページは [`mdi-core/src/lib.rs`](https://github.com/illusions-lab/MDI/blob/main/mdi-core/src/lib.rs) にあるものだけを記載します。自動 `cargo doc` site は **Planned** です。食い違いがあれば source を正としてください。

## Constants

- `MDI_SPEC_VERSION: &str = "2.0"`
- `MDI_IR_VERSION: &str = "1.0"`
- `MDI_STYLESHEET: &str` — `render_html` に埋め込まれる CSS。 [stylesheet parity](/ja/ecosystem/compatibility/#stylesheet-parity) を参照。

## Parsing

- `parse_document(source: &str) -> Document` — 完全な一回解析。
- `parse_output(source: &str) -> ParseOutput` — versioned envelope。
- `parse_json(source: &str) -> String` — FFI が渡る JSON。
- `parse_inlines(source: &str) -> Vec<Inline>` — MDI inline 専用。
- `parse_mdi_syntax(source: &str) -> MdiSyntaxDocument` — **deprecated** 互換 API。

## Serialization

`serialize_mdi(source: &str) -> String` / `serialize_mdi_document(document: &Document) -> String` は canonical MDI/Markdown に serialize します。例えば `《《text》》` を `[[em:text]]` に正規化します。

## Rendering

- `render_html` / `render_html_document` → standalone HTML
- `render_text` / `render_text_document` → plain `txt`
- `render_text_format(source, format: TextFormat, indent_prefix)` → `txt`、`txt-ruby`、`narou`、`kakuyomu`、`aozora`
- `render_epub` / `render_epub_document` → `Result<Vec<u8>, String>` EPUB 3
- `render_docx` / `render_docx_document` → `Result<Vec<u8>, String>` DOCX
- `render_pdf(source, options: &PdfOptions)` → local Chromium による PDF
- `find_chromium() -> Option<PathBuf>` → Chromium の best-effort search

## Public data types

current-generation API は `ParseOutput`、`ParserCapabilities`、`Diagnostic`、`SourceSpan`、`Document`、`Frontmatter`、`PdfOptions` です。旧 shape は `MdiSyntaxDocument`、`MdiBlock`、`PagebreakVariant`、`Inline`、`RubyReading` です。

## Not yet implemented

- `parse_output` と別個の validation API はありません。
- `serialize_mdi` と別個の normalize API はありません。
- export-profile-aware EPUB/DOCX（cover、chapter split、page geometry、font）はありません。
- DOCX の ruby run、boten style、page geometry はありません。現在は typography を plain text に flatten します。

## 次へ

- [Rust binding](/ja/bindings/rust/)
- [Document IR](/ja/core/document-ir/)
- [レンダリングモデル](/ja/core/rendering/)
