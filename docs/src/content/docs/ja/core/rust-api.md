---
title: Rust Core API の提供状況
description: mdi-core が公開する主要 API と未対応項目
---

このページでは、`mdi-core/src/lib.rs` で公開している主要な API を示す。詳細なシグネチャは [docs.rs](https://docs.rs/mdi-core/) を正とする。

## 定数

- `MDI_SPEC_VERSION`: 対応する MDI 構文バージョン。
- `MDI_IR_VERSION`: 文書 IR のバージョン。
- `MDI_STYLESHEET`: HTML 出力に埋め込む CSS。

## 解析とシリアライズ

| API | 用途 |
| --- | --- |
| `parse_document(source)` | 文書 IR を取得する。 |
| `parse_output(source)` | バージョンと診断を含む解析結果を取得する。 |
| `parse_json(source)` | FFI 向けの JSON を取得する。 |
| `parse_inlines(source)` | MDI インライン要素を解析する。 |
| `serialize_mdi(source)` | MDI / Markdown を正規化して出力する。 |
| `serialize_mdi_document(document)` | 文書 IR をシリアライズする。 |

`parse_mdi_syntax` は旧互換 API であり、新規実装では `parse_document` または `parse_output` を使用する。

## 出力 API

| API | 結果 |
| --- | --- |
| `render_html` / `render_html_document` | HTML。 |
| `render_text` / `render_text_document` | プレーンテキスト。 |
| `render_text_format` | `txt-ruby`、`narou`、`kakuyomu`、`aozora` などのテキスト。 |
| `render_epub` / `render_epub_document` | EPUB 3 のバイト列。 |
| `render_docx` / `render_docx_document` | DOCX のバイト列。 |
| `render_pdf` | Chromium を利用した PDF のバイト列。 |

`render_epub`、`render_docx`、`render_pdf` は失敗時に `Result<Vec<u8>, String>` を返す。`find_chromium()` は PDF 出力に利用できる Chromium を探索する。

## 未対応・制限事項

- `parse_output` とは別の検証 API は提供していない。
- `serialize_mdi` とは別の正規化 API は提供していない。
- EPUB / DOCX のエクスポートプロファイル対応には未実装の設定がある。
- DOCX のルビ、傍点、ページ設定は完全な組版表現に未対応である。

## 次のステップ

- [Rust バインディング](/ja/bindings/rust/) — Rust プロジェクトから利用する。
- [ドキュメント IR](/ja/core/document-ir/) — 公開データ型を確認する。
