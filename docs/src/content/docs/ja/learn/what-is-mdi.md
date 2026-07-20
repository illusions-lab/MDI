---
title: MDI とは
description: 日本語組版に必要な表現を Markdown に追加する記法とツールキット
---

## 概要

**MDI（illusion Markdown）** は、日本語の出版・組版向けに Markdown を拡張する記法である。拡張子には通常 `.mdi` を用いる。CommonMark や GFM の記法はそのまま使え、必要な箇所だけに MDI の記法を追加できる。

```mdi
---
title: 雪女
lang: ja
writing-mode: vertical
---

# 第一章

{雪女|ゆきおんな}が現れたのは、第^12^話のことだった。
[[em:決して]]忘れない、と彼は思った。
```

この例では、`{...|...}` がルビ、`^...^` が縦中横、`[[em:...]]` が傍点を表す。

## MDI を使う場面

MDI は、次のような文書に適している。

- ルビ、縦書き、傍点などを含む小説・脚本・出版原稿
- 1 つの原稿から Web、電子書籍、Word 文書、投稿サイト用テキストを作成するワークフロー
- プレーンテキストで原稿を管理し、Git などで差分を確認したい場合

MDI は WYSIWYG 形式や汎用のページレイアウト言語ではない。組版上の意味をテキストで記述し、出力形式ごとのレンダラーに委ねるための記法である。

## Markdown との違い

| 項目 | CommonMark / GFM | MDI |
| --- | --- | --- |
| 見出し、リスト、リンク、表、コード | 対応 | 対応 |
| ルビ、縦中横、傍点、割注 | 規定なし | 対応 |
| 縦書き | 規定なし | front matter で指定 |
| 明示的な改行 | 実装依存 | `[[br]]` を使用可能 |
| 出力 | 利用ツールに依存 | HTML、テキスト、EPUB、DOCX、PDF |

MDI 固有の記法がない文書は、通常の Markdown と同じように扱える。曖昧または不正な MDI 記法は、多くの場合、リテラルテキストとして扱われる。

## 処理の流れ

```text
.mdi ソース
    ↓
mdi-core（Rust）
    ↓
文書 IR と診断情報
    ├─ HTML
    ├─ TXT / 投稿サイト向けテキスト
    ├─ EPUB
    ├─ DOCX
    └─ PDF（HTML を Chromium でページレイアウト）
```

MDI の構文は Rust 製の `mdi-core` が解釈する。CLI や各言語のバインディングが独自の構文解析を行うことはないため、実行環境が変わっても解析結果と診断の意味を揃えられる。

PDF は `mdi-core` が生成した HTML を Chromium でページレイアウトする方式である。Chromium は `.mdi` の構文を解析しない。

## 次のステップ

- [はじめに](/ja/guides/getting-started/) — CLI と JavaScript API を使って変換する。
- [コア概念](/ja/learn/core-concepts/) — 文書 IR、診断、ソース位置の扱いを理解する。
- [構文リファレンス](/ja/syntax/reference/) — MDI 固有の記法を確認する。
