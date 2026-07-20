---
title: Rust
description: Rust project から mdi-core を直接使う方法。
---

**前提:** [Document IR](/ja/core/document-ir/)、[Rust Core API](/ja/core/rust-api/)。

## この binding で解決すること

Rust application、tool、または別言語用 native binding を書くなら、`mdi-core` を直接依存にできます。FFI/WASM 境界なしで使える native の経路であり、ほかの language binding はこの crate の薄い wrapper です。

## Install

`mdi-core` は [crates.io](https://crates.io/crates/mdi-core) で公開されています。

```toml
[dependencies]
mdi-core = "2.0"
```

## 最小例

```rust
use mdi_core::{parse_document, render_html};
fn main() {
    let source = "第^12^話。{東京|とうきょう}は雨だった。";
    let document = parse_document(source);
    assert_eq!(document.children.len(), 1);
    println!("{}", render_html(source));
}
```

## 入出力の型

`parse_document(&str) -> Document` と `parse_output(&str) -> ParseOutput` が parse entry point です。各 renderer（`render_html`、`render_text`、`render_text_format`、`render_epub`、`render_docx`、`render_pdf`）は raw `&str` 版と `*_document` 版を持ちます。複数形式を同じ tree から出すなら `render_html_document(&document)` のような後者を使い、解析を一度にしてください。

## Diagnostic と error handling

不正な MDI syntax は panic せず literal fallback になります。一方 EPUB/DOCX/PDF は I/O や Chromium 不在で `Result<Vec<u8>, String>` を返します。

```rust
match mdi_core::render_pdf(source, &mdi_core::PdfOptions::default()) {
    Ok(bytes) => std::fs::write("out.pdf", bytes)?,
    Err(message) => eprintln!("PDF render failed: {message}"),
}
```

## IR version と UTF-8 byte span

`MDI_IR_VERSION` と `MDI_SPEC_VERSION` は exported constant です。永続化した `ParseOutput` を読み直すなら version を確認してください。`SourceSpan { start_byte, end_byte }` は UTF-8 byte の半開 range で、`char` index ではありません。

## 現在の実装状況

parse、`serialize_mdi`、HTML/TXT/EPUB/DOCX/PDF renderer はすべて実装済みです。baseline の正確な範囲は [Rust Core API](/ja/core/rust-api/#not-yet-implemented) を参照してください。

## この binding がしないこと

- **async API はありません。** すべて同期的で、`render_pdf` は Chromium subprocess を待ちます。async runtime では Tokio の `spawn_blocking` 等で包んでください。

## 次へ

- [docs.rs API reference](https://docs.rs/mdi-core/)
- [レンダリングモデル](/ja/core/rendering/)
