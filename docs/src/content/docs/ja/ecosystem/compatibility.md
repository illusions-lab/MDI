---
title: 互換性と移行
description: 仕様・スタイルシートの差異と非推奨 API
---

MDI 2.0 の人間向けの構文仕様は [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) である。このページでは、既存パッケージとの互換性に関する注意点を示す。

## スタイルシートの差異

`mdi-to-hast` のスタイルシートは `SYNTAX.md` の例に近い。一方、`mdi-core` の `render_html` が埋め込むスタイルシートには、次の差異がある。

| セレクター | 影響 |
| --- | --- |
| `.mdi-em` | ルビの読み仮名に傍点が重なる場合がある。 |
| `.mdi-warichu` | 2 行組の割注を近似するスタイルがない。 |
| `.mdi-blank` | 縦書き時の空白段落の高さが意図どおりにならない場合がある。 |

HTML 要素とクラス名の構造は共通である。仕様に近いスタイルが必要な場合は `mdi-to-hast` のスタイルシートを使用する。

## 非推奨 API

| 非推奨 API | 代替 | 理由 |
| --- | --- | --- |
| JavaScript の `parseMdiSyntax` | `parse` | 完全な文書 IR を返す API へ移行するため。 |
| Rust の `parse_mdi_syntax` | `parse_document` または `parse_output` | front matter、通常の Markdown ノード、ソース位置を含む新しい IR を使用するため。 |

IR を外部で扱う場合は `irVersion` を確認する。未知のバージョンの構造を推測して処理してはならない。ソース位置は UTF-8 のバイトオフセットである。

## 次のステップ

- [Rust Core API の提供状況](/ja/core/rust-api/) — 現行 API を確認する。
- [構文リファレンス](/ja/syntax/reference/) — 記法を確認する。
