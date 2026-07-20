---
title: Migration と compatibility
description: SYNTAX.md と現在の実装との差分、および deprecated API。
---

MDI 2.0 syntax の規範は [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) です。このページは実装との差分を明示します。

## Stylesheet parity

`mdi-to-hast` の stylesheet は `SYNTAX.md` と一致します。一方 `mdi-core` の `render_html` embedded stylesheet（CLI `--to html` と direct `renderHtml()` が出荷する CSS）には三つの差があります。

| selector | SYNTAX.md / mdi-to-hast | mdi-core | 影響 |
| --- | --- | --- | --- |
| `.mdi-em` | emphasis position、`-webkit-`、`rt` suppression | これらなし | ruby の reading に boten が重なる可能性 |
| `.mdi-warichu` | 2行 wrap 用 inline-block CSS | `font-size: .6em` のみ | 2行近似がない |
| `.mdi-blank` | `min-block-size: 1lh` | `min-height: 1em` | vertical writing で意図した space にならない |

HTML element/class 構造は同一です。spec-parity が必要なら `mdi-to-hast` stylesheet を使ってください。

## Deprecated APIs

| Deprecated | 代替 | 理由 |
| --- | --- | --- |
| JS `parseMdiSyntax` | `parse` | 現在は direct alias |
| Rust `parse_mdi_syntax` | `parse_document` / `parse_output` | span/front matter/通常 Markdown node のない旧 `MdiSyntaxDocument` |

## IR version の扱い

`irVersion` は見た目の文字列ではなく wire protocol version として扱い、未知の値を推測して読まないでください。`@illusions-lab/mdi` の `parse()` 自身も、対応しない version なら `Unsupported MDI IR version` を throw します。JSON wire format を直接使う新しい integration でも同じ確認を行ってください。

## 文字 index ではなく byte span

すべての span は UTF-8 byte offset です。host language の文字 index としてそのまま扱わず、明示的に変換してください。JavaScript の変換例は [Diagnostics](/ja/core/diagnostics/#span) を、Python の注意点は [Python binding](/ja/bindings/python/) を参照してください。Swift を含むすべての binding で同じ注意が必要です。

## Remark adapter は現在一方向

`@illusions-lab/mdi-remark` は実際の Rust 出力を `mdast` に解析する adapter です。ただし編集済み `mdast` を `.mdi` text に戻す際には、Rust の recommended-form normalization（たとえば `《《...》》` を `[[em:...]]` にする処理）はまだ適用しません。詳しくは [Remark / mdast adapter](/ja/ecosystem/remark/) を参照してください。

## ドキュメントのビルドについて

このサイト内の Markdown/MDI 例は `astro.config.mjs` により `@illusions-lab/mdi-remark` で描画されます。専用の別 parser ではありません。サイトの例が CLI や JavaScript package と異なる結果になれば、それは意図した差ではなく報告すべきバグです。

## 次へ

- [Rust Core API](/ja/core/rust-api/#not-yet-implemented)
- [構文リファレンス](/ja/syntax/reference/)
