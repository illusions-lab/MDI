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

検索用 canonical text は `get_mdi_text_blocks(source)`、逆引きは
`resolve_mdi_source_span(source, span)` を使います。後者は順序、範囲、UTF-8
boundary を検証し、本文と annotation の maximal grapheme range、
`Complete | Partial | None` coverage、`Exact | Overlap` relation を返します。
空 span、純構造 delimiter、synthetic、unmapped source は range を作りません。
Ruby の別 channel や multi-to-one/discontinuous mapping により、round trip は
一般に bijection ではありません。

diagnostics や decoration の一括処理には `resolve_mdi_source_spans(source,
spans)` を使います。slice 全体を検証してから一度だけ parse/projection を行い、
入力順に結果を返します。

## 現在の実装状況

parse、`serialize_mdi`、HTML/TXT/EPUB/DOCX/PDF renderer はすべて実装済みです。baseline の正確な範囲は [Rust Core API](/ja/core/rust-api/#not-yet-implemented) を参照してください。

## この binding がしないこと

- **async API はありません。** すべて同期的で、`render_pdf` は Chromium subprocess を待ちます。async runtime では Tokio の `spawn_blocking` 等で包んでください。

## 次へ

- [docs.rs API reference](https://docs.rs/mdi-core/)
- [レンダリングモデル](/ja/core/rendering/)

## 割注の自動組版

分割規則は Rust が一元管理します。本文の50%の字級、固定2行、行間なしで表示します。先頭の断片には本文行の残り幅、後続には行全体の幅を指定できます。幅の単位は割注字級の半角emです。文字幅の推定であり、比例フォントの厳密な均衡は保証しません。

```rust
let children = serde_json::json!([{"type":"text", "value":"一二三四五六"}]);
let fragments = mdi_core::layout_warichu_with_options(children.as_array().unwrap(),
    &mdi_core::WarichuOptions { first_capacity: 2, continuation_capacity: 4 });
```

戻り値は `lines`、`html`、`widths`、`overflow`、`hardBreakAfter`、`sources` を含みます。`path` は入力配列からの子インデックス列、`startUtf8` / `endUtf8` は可視文字列内の半開UTF-8バイト範囲です。同一の `group` は書式境界をまたぐ書記素も分割しません。ルビ、縦中横、改行禁止は一体として扱います。明示改行を保ち、自動分割は正規MDIや平文に書き戻しません。静的HTML/EPUBは閲覧ソフトにより再配置が異なります。DOCXはネイティブの双行グループを使います。XMLやインポーターの検証をWordの描画実測とは記載しません。
