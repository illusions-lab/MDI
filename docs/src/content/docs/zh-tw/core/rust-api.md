---
title: Rust Core API 狀態
description: "`mdi-core/src/lib.rs` 現在實際公開的所有 symbol，包含 signature；不列猜測或願景項目。"
---

**先備知識：**[Document IR](/zh-tw/core/document-ir/)。

本頁只列出目前 [`mdi-core/src/lib.rs`](https://github.com/illusions-lab/MDI/blob/main/mdi-core/src/lib.rs) 中存在的 symbol。它是導覽頁而非生成的 `rustdoc`；自動 `cargo doc` 網站整合仍為 **Planned**。如與 source 不一致，應信任 source 並把本頁視為有 bug。

## Constants

- `MDI_SPEC_VERSION: &str = "2.0"` — crate 實作的 MDI syntax version。
- `MDI_IR_VERSION: &str = "1.0"` — `ParseOutput`/`Document` wire-format version。
- `MDI_STYLESHEET: &str` — 直接嵌於 `render_html` 輸出的 minified CSS。與 `@illusions-lab/mdi-to-hast` package CSS 的差異見[相容性](/zh-tw/ecosystem/compatibility/#stylesheet-parity)。

## Parsing

- `parse_document(source: &str) -> Document` — 主 entry point；一趟解析 CommonMark、GFM、front matter 與 MDI。
- `parse_output(source: &str) -> ParseOutput` — 為 `parse_document` 加上 versioned envelope（`irVersion`、`syntaxVersion`、`capabilities`、`document`、`diagnostics`）。
- `parse_json(source: &str) -> String` — `parse_output` 序列化為 JSON，是每個 binding 跨越的實際 FFI boundary。
- `parse_inlines(source: &str) -> Vec<Inline>` — 僅解析 MDI inline syntax，忽略 block structure；供內部與 focused inline-only test 使用。
- `parse_mdi_syntax(source: &str) -> MdiSyntaxDocument` — **deprecated compatibility helper**；回傳[Document IR](/zh-tw/core/document-ir/#過渡期的-mdisyntaxdocument-形狀)描述的舊、簡單 `MdiSyntaxDocument`。新程式使用 `parse_document` 或 `parse_output`。

## Serialization

- `serialize_mdi(source: &str) -> String` / `serialize_mdi_document(document: &Document) -> String` — canonical MDI/Markdown serialization。將 parse 過的 document round-trip 為 normalized `.mdi` source，套用 `SYNTAX.md` 建議形式（例如 `《《text》》` → `[[em:text]]`）。

## Rendering

- `render_html(source: &str) -> String` / `render_html_document(document: &Document) -> String` — standalone HTML。
- `render_text(source: &str) -> String` / `render_text_document(document: &Document) -> String` — deterministic plain text（硬編碼 `txt` flavor）。
- `render_text_format(source: &str, format: TextFormat, indent_prefix: &str) -> String` — 六種 TXT flavor。`TextFormat` 為 `Plain | Ruby | Narou | Kakuyomu | Aozora | Note`，透過 `TextFormat::parse` 解析 `txt`/`txt-ruby`/`narou`/`kakuyomu`/`aozora`/`note`。
- `render_epub(source: &str) -> Result<Vec<u8>, String>` / `render_epub_document(document: &Document) -> Result<Vec<u8>, String>` — 完整 EPUB 3 archive。
- `render_epub_with_profile(source: &str, profile_json: &str, cover: Option<&EpubCover>) -> Result<Vec<u8>, String>` / `render_epub_document_with_profile(...)` — 支援 metadata、typography、chapter split 與 optional PNG/JPEG cover 的設定型 EPUB。
- `render_docx(source: &str) -> Result<Vec<u8>, String>` / `render_docx_document(document: &Document) -> Result<Vec<u8>, String>` — 完整 DOCX archive。
- `render_docx_with_profile(source: &str, profile_json: &str) -> Result<Vec<u8>, String>` / `render_docx_document_with_profile(...)` — 支援 OOXML page geometry、typography、grid、mirror margin 與頁碼的設定型 DOCX。
- `render_pdf(source: &str, options: &PdfOptions) -> Result<Vec<u8>, String>` — Rust-rendered HTML 交給 local Chromium layout。見[轉譯模型](/zh-tw/core/rendering/#chromiumpdf-邊界)。
- `find_chromium() -> Option<PathBuf>` — `PdfOptions.chromium_path` 為 `None` 時 best-effort 搜尋本機 Chromium-family executable。

## Publication profile

- `resolve_export_profile(...)` / `resolve_export_profile_json(...)` — 驗證 canonical profile 並補齊 default，也可繼承文件 writing mode。
- `page_dimensions(page_size: &str) -> Option<(f64, f64)>` / `page_size_catalog_json() -> Result<String, String>` — binding 與 renderer 共用的 67 種 physical paper catalogue。
- `prepare_chromium_print_profile(...)` 及 JSON/resolved variants — 為 Chromium host 產生 styled HTML、mm page geometry、margin 與 page-number template。
- `apply_pdf_profile(...)` / `apply_pdf_profile_json(...)` — 不啟動 browser，直接套用 resolved print CSS。

## Public data types

`ParseOutput`、`ParserCapabilities`、`Diagnostic`、`DiagnosticSeverity`、`SourceSpan`、`Document`、`Frontmatter`、`FrontmatterEntry`、`PdfOptions`、`EpubCover`、`ResolvedExportProfile` 與其 nested profile/Chromium print types（目前 API）；`MdiSyntaxDocument`、`MdiBlock`、`PagebreakVariant`、`Inline`、`RubyReading`（較舊、只供 `parse_mdi_syntax` 的 shape；`Inline`/`RubyReading` 也在內部用來建立目前 `Document` 的 MDI nodes）。

## 尚未實作

以下概念出現在 `ARCHITECTURE.md`/`SYNTAX.md`，但今日 `mdi-core` **沒有對應 function**：

- 獨立於 `parse_output` 的 **standalone validation API**。今日 validation 就是 parsing 時 `parse_output` 回傳的 diagnostics，沒有 `validate(document, options)`。
- 獨立於 `serialize_mdi` 的 **normalize API**。serialization round-trip 時已套用推薦形式 normalization，沒有只 normalize 不 serialize 的 function。

DOCX 現在會以 native 或 portable OOXML 表示 ruby、tate-chu-yoko、
emphasis、kern、page geometry 等支援項目。Word-compatible reader 的日文
行組仍可能不同，因此這代表格式支援，而非承諾與 browser 像素完全一致。

## 下一步

- [Rust 綁定](/zh-tw/bindings/rust/)
- [Document IR](/zh-tw/core/document-ir/)
- [轉譯模型](/zh-tw/core/rendering/)
