---
title: Rust
description: 在 Rust project 直接使用 mdi-core：沒有 FFI overhead 的 native 路徑。
---

**先備知識：**[Document IR](/zh-tw/core/document-ir/)、[Rust Core API](/zh-tw/core/rust-api/)。

## 這個綁定解決什麼

JavaScript/WASM、Python 與未來 Swift 等其他介面都是此 crate 的薄包裝。若你在寫 Rust application、tool 或另一語言的 native binding，可直接依賴 `mdi-core`，跳過 FFI/WASM boundary。

## 安裝

從 [crates.io](https://crates.io/crates/mdi-core) 安裝 `mdi-core`：

```toml
[dependencies]
mdi-core = "2.0"
```

## 最小可執行範例

```rust
use mdi_core::{parse_document, render_html};
fn main() {
    let source = "第^12^話。{東京|とうきょう}は雨だった。";
    let document = parse_document(source);
    assert_eq!(document.children.len(), 1);
    println!("{}", render_html(source));
}
```

## Input 與 output types

`parse_document(&str) -> Document` 與 `parse_output(&str) -> ParseOutput` 是兩個 parsing entry point。各 renderer（`render_html`、`render_text`、`render_text_format`、`render_epub`、`render_docx`、`render_pdf`）都可收 raw `&str`（內部 parse）或使用 `*_document` 版本收已解析的 `&Document`；多格式輸出時應使用後者。完整 signature 見 [Rust Core API](/zh-tw/core/rust-api/)。

## Diagnostics 與 error handling

不正確的 MDI syntax 不會令 `parse_document`/`parse_output` panic，而是 literal fallback，見[診斷](/zh-tw/core/diagnostics/)。`render_epub`、`render_docx`、`render_pdf` 可能因外部資源失敗，回傳 `Result<Vec<u8>, String>`：

```rust
use mdi_core::{render_pdf, PdfOptions};
match render_pdf(source, &PdfOptions::default()) {
    Ok(bytes) => std::fs::write("out.pdf", bytes)?,
    Err(message) => eprintln!("PDF render failed: {message}"),
}
```

## IR version 與 UTF-8 byte spans

`MDI_IR_VERSION` 與 `MDI_SPEC_VERSION` 為 exported `&'static str` constants；儲存 `ParseOutput` 後再載入時應檢查。`SourceSpan { start_byte: u32, end_byte: u32 }` 是 half-open UTF-8 byte range，詳見[診斷](/zh-tw/core/diagnostics/)。

搜尋用 canonical text 可用 `get_mdi_text_blocks(source)`；反向查詢使用
`resolve_mdi_source_span(source, span)`。它會驗證順序、範圍與 UTF-8 boundaries，
回傳正文及 annotation 的最大 grapheme ranges、`Complete | Partial | None`
coverage 和 `Exact | Overlap` relation。空 span、純結構 delimiter、synthetic 與
unmapped source 都不會產生 range。Ruby 雙 channel 與多對一／不連續 mapping
代表 round trip 通常不是雙射。

diagnostics 或 decorations 的批次處理請使用 `resolve_mdi_source_spans(source,
spans)`；它先驗證整個 slice，只做一次 parse/projection，再依輸入順序回傳結果。

## 目前實作狀態

Parsing、`serialize_mdi` 及所有 renderer（`render_html`、`render_text_format`、`render_epub`、`render_docx`、`render_pdf`）皆已實作，限制見 [Rust Core API 尚未實作項目](/zh-tw/core/rust-api/#尚未實作)。沒有獨立 `validate`/`normalize` API，分別由 `parse_output`/`serialize_mdi` 擔任。

## 此綁定不做什麼

- **沒有 async API。**所有 function 都同步；`render_pdf` 會阻塞 Chromium subprocess。在 async runtime 請以 Tokio `spawn_blocking` 或等效方法包裝。

## 下一步

- [Rust Core API](/zh-tw/core/rust-api/)
- [docs.rs API reference](https://docs.rs/mdi-core/)
- [轉譯模型](/zh-tw/core/rendering/)

## 自動割注排版

分割規則由 Rust 統一實作。固定兩行、正文50%字級、零小行間距。首個片段可使用正文行剩餘容量，後續片段使用完整行容量。容量與回傳寬度以割注字級的半個em為單位；這是字寬估算，不保證比例字型的精確均衡。

```rust
let children = serde_json::json!([{"type":"text", "value":"一二三四五六"}]);
let fragments = mdi_core::layout_warichu_with_options(children.as_array().unwrap(),
    &mdi_core::WarichuOptions { first_capacity: 2, continuation_capacity: 4 });
```

結果包含 `lines`、`html`、`widths`、`overflow`、`hardBreakAfter` 與 `sources`。`path` 是從輸入陣列起算的子節點索引路徑；`startUtf8` / `endUtf8` 是可見文字中的半開UTF-8位元組範圍。相同 `group` 保留跨格式邊界的書寫素。Ruby、縱中橫及no-break保持不可拆。作者硬換行保留，自動分割不寫回canonical MDI或純文字。靜態HTML/EPUB的閱讀器重排結果可能不同。DOCX使用原生雙行群組；XML與匯入器檢查不代表Word實測。
