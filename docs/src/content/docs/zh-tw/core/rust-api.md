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
- `render_text_format(source: &str, format: TextFormat, indent_prefix: &str) -> String` — 五種 TXT flavor。`TextFormat` 為 `Plain | Ruby | Narou | Kakuyomu | Aozora`，透過 `TextFormat::parse` 解析 binding-facing 字串 `txt`/`txt-ruby`/`narou`/`kakuyomu`/`aozora`。
- `render_epub(source: &str) -> Result<Vec<u8>, String>` / `render_epub_document(document: &Document) -> Result<Vec<u8>, String>` — 完整 EPUB 3 archive。
- `render_docx(source: &str) -> Result<Vec<u8>, String>` / `render_docx_document(document: &Document) -> Result<Vec<u8>, String>` — 完整 DOCX archive。
- `render_pdf(source: &str, options: &PdfOptions) -> Result<Vec<u8>, String>` — Rust-rendered HTML 交給 local Chromium layout。見[轉譯模型](/zh-tw/core/rendering/#chromiumpdf-邊界)。
- `find_chromium() -> Option<PathBuf>` — `PdfOptions.chromium_path` 為 `None` 時 best-effort 搜尋本機 Chromium-family executable。

## Public data types

`ParseOutput`、`ParserCapabilities`、`Diagnostic`、`DiagnosticSeverity`、`SourceSpan`、`Document`、`Frontmatter`、`FrontmatterEntry`、`PdfOptions`（目前的 `Document`-based API）；`MdiSyntaxDocument`、`MdiBlock`、`PagebreakVariant`、`Inline`、`RubyReading`（較舊、只供 `parse_mdi_syntax` 的 shape；`Inline`/`RubyReading` 也在內部用來建立目前 `Document` 的 MDI nodes）。

## 尚未實作

以下概念出現在 `ARCHITECTURE.md`/`SYNTAX.md`，但今日 `mdi-core` **沒有對應 function**：

- 獨立於 `parse_output` 的 **standalone validation API**。今日 validation 就是 parsing 時 `parse_output` 回傳的 diagnostics，沒有 `validate(document, options)`。
- 獨立於 `serialize_mdi` 的 **normalize API**。serialization round-trip 時已套用推薦形式 normalization，沒有只 normalize 不 serialize 的 function。
- **Export-profile-aware EPUB/DOCX rendering**：cover image、可設定 chapter-split level、page geometry、font selection。`render_epub`/`render_docx` 現只讀 front-matter metadata（title/author/lang/writing-mode），不讀 [export profile](/zh-tw/ecosystem/export-profiles/)。
- **完整 DOCX typography**：OOXML 的 ruby runs、boten character styles、page geometry。現在 `render_docx` 將 MDI typography flatten 為 plain text runs，和 `render_text` 一樣。

## 下一步

- [Rust 綁定](/zh-tw/bindings/rust/)
- [Document IR](/zh-tw/core/document-ir/)
- [轉譯模型](/zh-tw/core/rendering/)
