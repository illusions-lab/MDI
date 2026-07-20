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

`irVersion` は wire protocol version として扱い、未知の値を推測して読まないでください。span は UTF-8 byte offset です。Remark は Rust の tree を mdast にする real adapter ですが、編集済み mdast を stringify する際に Rust の recommended-form normalization はまだ適用しません。

## 次へ

- [Rust Core API](/ja/core/rust-api/#not-yet-implemented)
- [構文リファレンス](/ja/syntax/reference/)
