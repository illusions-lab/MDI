---
title: Rust 主導のアーキテクチャ
description: MDI の構文と文書 IR を一つの Rust コアで管理する理由
---

## 基本方針

MDI の構文を解釈する正規実装は Rust 製の `mdi-core` である。CLI、JavaScript、Python、Swift、Android / Kotlin の各インターフェースは、`mdi-core` の結果を利用する。各環境が独自の構文解析器を持つことはない。

## 処理の全体像

```text
UTF-8 の .mdi ソース
        ↓
mdi-core（CommonMark / GFM / front matter / MDI を解析）
        ↓
バージョン付き文書 IR と診断情報
        ↓
各言語バインディング・CLI・レンダラー
```

文書 IR は解析結果の共通形式である。HTML、テキスト、EPUB、DOCX はこの IR を基に出力される。PDF は Rust が生成した HTML を Chromium でページレイアウトする。

## 一度だけ解析する理由

MDI の記法は Markdown の文脈に依存する。たとえば同じ `^12^` でも、コードスパン内では文字列であり、通常の本文では縦中横になり得る。レンダラーやバインディングが部分的に再解析すると、環境ごとに解釈が分かれるおそれがある。

解析を 1 か所に集約することで、次を保証しやすくなる。

- 構文とフォールバック規則の一貫性
- 診断コードとソース位置の一貫性
- 異なる出力形式での意味の一貫性
- IR バージョンによる互換性管理

## 仕様と実装

人が読む構文仕様は [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) である。実際の構文判断は `mdi-core` が行う。両者に差異がある場合は、互換性ページの記載を確認し、必要に応じて仕様または実装を更新する。

## 次のステップ

- [ドキュメント IR](/ja/core/document-ir/) — 解析結果の構造を確認する。
- [診断とソース位置](/ja/core/diagnostics/) — 問題の通知方法を確認する。
- [レンダリングモデル](/ja/core/rendering/) — 出力処理の境界を確認する。
