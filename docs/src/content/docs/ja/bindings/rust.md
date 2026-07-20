---
title: Rust
description: Rust アプリケーションから mdi-core を直接利用する
---

`mdi-core` は MDI 構文の正規実装である。Rust アプリケーションでは、文書の解析、シリアライズ、HTML・テキスト・EPUB・DOCX・PDF の生成を直接利用できる。

## インストール

```toml
[dependencies]
mdi-core = "2.0"
```

`mdi-core` は [crates.io](https://crates.io/crates/mdi-core) で公開している。

## 基本例

```rust
use mdi_core::{parse_document, render_html};

fn main() {
    let source = "第^12^話。{東京|とうきょう}は雨だった。";
    let document = parse_document(source);

    assert_eq!(document.children.len(), 1);
    println!("{}", render_html(source));
}
```

`parse_document(&str)` は文書ツリーを、`parse_output(&str)` はバージョン情報と診断情報を含む結果を返す。解析済みの文書から複数形式を出力する場合は、`render_html_document(&document)` のような `*_document` 系 API を使用する。

## エラー処理とソース位置

通常の不正な MDI 記法はパニックせず、リテラルテキストへのフォールバックまたは診断として扱われる。EPUB、DOCX、PDF の生成は I/O エラーや Chromium の不在により失敗する可能性があり、`Result<Vec<u8>, String>` を返す。

```rust
match mdi_core::render_pdf(source, &mdi_core::PdfOptions::default()) {
    Ok(bytes) => std::fs::write("out.pdf", bytes)?,
    Err(message) => eprintln!("PDF の生成に失敗しました: {message}"),
}
```

`SourceSpan` は UTF-8 のバイト単位による半開区間である。`char` のインデックスとして扱わないこと。

## 実装状況

解析、`serialize_mdi`、HTML、テキスト、EPUB、DOCX、PDF のレンダラーを提供する。独立した `validate` / `normalize` API、DOCX の完全な組版、エクスポートプロファイルを利用する EPUB / DOCX には未対応の項目がある。

## 次のステップ

- [docs.rs API リファレンス](https://docs.rs/mdi-core/) — Rust API の詳細を確認する。
- [レンダリングモデル](/ja/core/rendering/) — 各出力形式の責務を確認する。
