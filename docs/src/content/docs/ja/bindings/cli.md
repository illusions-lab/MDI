---
title: CLI
description: "@illusions-lab/mdi-cli を使って .mdi ファイルを変換する"
---

`@illusions-lab/mdi-cli` は、`.mdi` ファイルを HTML、PDF、EPUB、DOCX、テキストへ変換するコマンドラインツールである。構文解析と出力生成には Rust コアを使用する。

## インストール

```bash
npm install --global @illusions-lab/mdi-cli
```

Node.js 20 以降が必要である。PDF を生成する場合は Chromium 系ブラウザも必要になる。

## 基本構文

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

| 引数・オプション | 必須 | 説明 |
| --- | --- | --- |
| `<input.mdi>` | はい | UTF-8 の入力ファイル。 |
| `--to <format>` | はい | 出力形式。 |
| `-o <output>` | いいえ | 出力パス。`txt-all` と併用できない。 |
| `--config <path>` | いいえ | [エクスポートプロファイル](/ja/ecosystem/export-profiles/)の JSON ファイル。 |

```bash
mdi build novel.mdi --to html
mdi build novel.mdi --to epub -o dist/novel.epub
mdi build novel.mdi --to pdf --config print.json
```

## 出力形式

| `--to` | 既定の出力名 | 内容 |
| --- | --- | --- |
| `html` | `.html` | スタイルを含む HTML。 |
| `pdf` | `.pdf` | Rust 生成の HTML を Chromium で PDF 化する。 |
| `epub` | `.epub` | EPUB 3。 |
| `docx` | `.docx` | DOCX。 |
| `txt` | `.txt` | ルビを除くプレーンテキスト。 |
| `txt-ruby` | `_ruby.txt` | ルビを保持するテキスト。 |
| `narou` / `kakuyomu` / `aozora` | 形式に対応する接尾辞 | 各投稿先向けテキスト。`aozora` は Shift_JIS。 |
| `txt-all` | 6 種類のテキストファイル | `-o` は指定できない。 |

HTML、テキスト、EPUB、DOCX は Rust コアが直接生成する。PDF では Chromium をページレイアウト専用に使用するため、Chromium が MDI 構文を解析することはない。

## 終了状態と制限

成功時は `Written <path>` を出力して終了コード `0` を返す。失敗時はエラーを標準エラー出力へ表示し、終了コード `1` を返す。

`--config` は現在、PDF のページ設定・フォントと、テキストの字下げに適用される。EPUB と DOCX は front matter のメタデータを利用するが、エクスポートプロファイルの全項目には未対応である。

## 次のステップ

- [はじめに](/ja/guides/getting-started/) — 最初の変換を実行する。
- [エクスポートプロファイル](/ja/ecosystem/export-profiles/) — 出力設定を指定する。
- [レンダリングモデル](/ja/core/rendering/) — PDF 出力の構成を確認する。
