---
title: 診断とソース位置
description: MDI が返す診断情報と UTF-8 バイト単位のソース位置
---

解析結果の `diagnostics` には、処理を継続できる問題が格納される。通常の構文上の問題で例外を発生させず、利用側が問題を表示・記録できるようにするための仕組みである。

## 診断の形式

診断には、重要度、安定したコード、メッセージ、ソース位置が含まれる。

```json
{
  "severity": "warning",
  "code": "mdi.version.unsupported",
  "message": "MDI 2.1 is newer than the supported 2.0",
  "span": { "startByte": 0, "endByte": 34 }
}
```

アプリケーションでは、文言ではなく `code` を基準に処理を分岐すること。`message` は利用者への表示に用いる。

## 現在の診断コード

| コード | 重要度 | 意味 |
| --- | --- | --- |
| `mdi.version.unsupported` | `warning` | front matter が、実装で対応するものより新しい MDI 構文バージョンを宣言している。 |

この場合も解析はベストエフォートで継続する。未知の構文を完全に解釈できることを意味しないため、警告を確認して文書または利用するライブラリのバージョンを見直すこと。

## ソース位置（span）

`span` は UTF-8 バイト列における半開区間である。`startByte` は含み、`endByte` は含まない。

```text
{東京|とうきょう}
^                ^
startByte        endByte
```

これは文字数や JavaScript の UTF-16 インデックスではない。UI 上で選択範囲を表示する場合は、UTF-8 のバイト位置を使用しているエディタの位置表現へ変換する必要がある。

## 次のステップ

- [コア概念](/ja/learn/core-concepts/) — IR と診断の役割を確認する。
- [ドキュメント IR](/ja/core/document-ir/) — ノードに付与されるソース位置を確認する。
