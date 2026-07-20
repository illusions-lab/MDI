---
title: 出力形式
description: HTML、テキスト、EPUB、DOCX、PDF の出力方法と用途
---

すべての出力は同じ文書 IR を基にする。出力形式ごとに別の MDI 構文やパーサーを使用することはない。

| 形式 | 利用箇所 | 生成方法 |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi`、CLI | Rust コアがスタイルを含む HTML を生成する。 |
| テキスト | `@illusions-lab/mdi`、CLI | Rust コアがプレーンテキストおよび投稿先向け形式を生成する。 |
| EPUB | `@illusions-lab/mdi`、CLI | Rust コアが EPUB 3 アーカイブを生成する。 |
| DOCX | `@illusions-lab/mdi`、CLI | Rust コアが DOCX を生成する。 |
| PDF | CLI、`@illusions-lab/mdi-to-pdf` | Rust 生成の HTML を Chromium でページレイアウトする。 |

## テキスト形式

テキスト出力では、`txt`、`txt-ruby`、`narou`、`kakuyomu`、`aozora` を選択できる。`aozora` は Shift_JIS、それ以外は UTF-8 で出力する。複数のテキスト形式をまとめて出力するには CLI の `txt-all` を使用する。

## 互換性パッケージ

`mdi-to-hast`、`mdi-to-html`、`mdi-to-epub`、`mdi-to-docx` は既存利用者との互換性のために公開を継続している。CLI の `build` はこれらのパッケージを経由せず、Rust コアを利用する。

`mdi-to-hast` のスタイルシートには Rust コアの HTML 出力と差異がある。詳細は[互換性と移行](/ja/ecosystem/compatibility/)を参照のこと。

## 制限事項

EPUB / DOCX は基本出力に対応するが、エクスポートプロファイルのカバー、章分割、ページ設定、フォントには未対応の項目がある。

## 次のステップ

- [レンダリングモデル](/ja/core/rendering/) — PDF の処理境界を確認する。
- [エクスポートプロファイル](/ja/ecosystem/export-profiles/) — PDF とテキストの設定を指定する。
