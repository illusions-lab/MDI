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

## 目前實作狀態

Parsing、`serialize_mdi` 及所有 renderer（`render_html`、`render_text_format`、`render_epub`、`render_docx`、`render_pdf`）皆已實作，限制見 [Rust Core API 尚未實作項目](/zh-tw/core/rust-api/#not-yet-implemented)。沒有獨立 `validate`/`normalize` API，分別由 `parse_output`/`serialize_mdi` 擔任。

## 此綁定不做什麼

- **沒有 async API。**所有 function 都同步；`render_pdf` 會阻塞 Chromium subprocess。在 async runtime 請以 Tokio `spawn_blocking` 或等效方法包裝。

## 下一步

- [Rust Core API](/zh-tw/core/rust-api/)
- [docs.rs API reference](https://docs.rs/mdi-core/)
- [轉譯模型](/zh-tw/core/rendering/)
