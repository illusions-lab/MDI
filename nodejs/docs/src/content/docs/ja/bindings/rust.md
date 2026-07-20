---
title: Rust
description: Rust project から mdi-core を直接使う方法。
---

**前提:** [Document IR](/ja/core/document-ir/)、[Rust Core API](/ja/core/rust-api/)。

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

`parse_document(&str)` と `parse_output(&str)` が parse entry point です。複数形式を同じ tree から出すなら `render_html_document(&document)` のような `*_document` variant を使います。

## Error と span

不正な MDI syntax は panic せず literal fallback になります。一方 EPUB/DOCX/PDF は I/O や Chromium 不在で `Result<Vec<u8>, String>` を返します。

```rust
match mdi_core::render_pdf(source, &mdi_core::PdfOptions::default()) {
    Ok(bytes) => std::fs::write("out.pdf", bytes)?,
    Err(message) => eprintln!("PDF render failed: {message}"),
}
```

`MDI_IR_VERSION` と `MDI_SPEC_VERSION` は exported constant です。`SourceSpan` は UTF-8 byte の半開 range で、`char` index ではありません。

## 状況

parse、`serialize_mdi`、HTML/TXT/EPUB/DOCX/PDF renderer はすべて実装済みです。別個の `validate` / `normalize` API、full DOCX typography、export profile を読む EPUB/DOCX はまだありません。

## 次へ

- [docs.rs API reference](https://docs.rs/mdi-core/)
- [レンダリングモデル](/ja/core/rendering/)
