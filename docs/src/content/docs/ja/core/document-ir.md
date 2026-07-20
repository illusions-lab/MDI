---
title: ドキュメント IR
description: MDI の解析結果を表すバージョン付きの文書中間表現
---

MDI の解析結果は、出力形式に依存しない文書 IR として返る。各バインディングはこの IR を基本として、言語に対応したデータ構造へ変換する。

## 解析結果の外側の構造

`parse_output` および各バインディングの `parse` は、文書本体に加えてバージョン、機能、診断情報を返す。

```json
{
  "syntaxVersion": "2.0",
  "irVersion": "1.0",
  "capabilities": { "mdi": true, "commonMark": true },
  "document": { "children": [] },
  "diagnostics": []
}
```

`irVersion` はデータ形式の互換性を表す。IR を保存・転送する利用側は、未対応のバージョンを推測して読み込んではならない。

## Document

`Document` は文書のルートノードである。front matter、ブロックノード、ソース位置を保持する。ブロックノードには、見出し、段落、引用、リスト、コードブロック、表、改ページなどがある。

段落などのインライン要素には、テキスト、強調、リンク、コード、ルビ、縦中横、傍点、割注、字間調整、改行などが含まれる。CommonMark / GFM の要素と MDI 固有の要素は同じ文書ツリーに格納される。

## front matter

front matter は `document.frontmatter` に保持される。キーの順序と未知のキーも保持されるため、レンダラーが認識しない独自メタデータを文書に含められる。

代表的な MDI 関連キーは `mdi`、`lang`、`writing-mode`、`page-progression` である。各キーの意味は[構文リファレンス](/ja/syntax/reference/)を参照のこと。

## ソース位置

ソース由来のノードには `span` が付く。`span` は UTF-8 バイト列上の半開区間であり、文字数や UTF-16 インデックスではない。詳細は[診断とソース位置](/ja/core/diagnostics/)を参照のこと。

## 旧 API

`MdiSyntaxDocument` とその関連型は、MDI 固有の構文だけを表現していた旧 API である。新規実装では CommonMark / GFM と front matter を含む `Document` および `ParseOutput` を使用する。

## 次のステップ

- [コア概念](/ja/learn/core-concepts/) — IR の位置付けを確認する。
- [Rust Core API の提供状況](/ja/core/rust-api/) — API を確認する。
