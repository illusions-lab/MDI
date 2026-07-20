---
title: HTML / TXT / EPUB / DOCX / PDF 出力
description: 各出力の意味、renderer、layout の担当範囲。
---

**前提:** [レンダリングモデル](/ja/core/rendering/)。すべて同じ [Document IR](/ja/core/document-ir/) の変換であり、別の syntax layer ではありません。

| Format | package | 実体 |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi` (`renderHtml`) | embedded `.mdi-*` CSS を含む standalone HTML |
| TXT（5種） | `@illusions-lab/mdi` (`renderTextFormat`) / CLI | plain、ruby-preserving、投稿サイト規約 text。 [TXT 書き出し](/ja/syntax/reference/) を参照 |
| EPUB | `@illusions-lab/mdi` (`renderEpub`) | reflowable XHTML、`nav.xhtml`、CSS、OPF を Rust が zip する EPUB 3 archive |
| DOCX | `@illusions-lab/mdi` (`renderDocx`) | Rust が zip する OOXML（WordprocessingML）document |
| PDF | `@illusions-lab/mdi-to-pdf` | Rust HTML/print CSS を local Chromium が layout |

PDF 以外の四形式は Rust 内で直接生成されます。CLI と JavaScript package に中間 JavaScript renderer はありません。PDF も native host の `render_pdf` / `find_chromium` を使い、Chromium は `.mdi` source ではなく完成 HTML/CSS だけを受け取ります。

## Legacy compatibility packages

`mdi-to-hast`、`mdi-to-html`、`mdi-to-epub`、`mdi-to-docx` は published のままです。これは current Rust-native renderer より前からある mdast/HAST path 向けです。[remark adapter](/ja/ecosystem/remark/) で既に `mdast` tree を持つ unified consumer は、二度目の parse なしに利用できます。CLI `build` は使用しません。`mdi-to-hast` の CSS は Rust `render_html` embedded CSS より `SYNTAX.md` に近い点があり、詳細は [stylesheet parity](/ja/ecosystem/compatibility/#stylesheet-parity) を参照してください。

## 全 renderer でまだ pending のこと

EPUB/DOCX の cover、configurable chapter split、page geometry/font の export-profile 対応は pending です。現在は front matter の `title`、`author`、`lang`、`writing-mode` のみを読みます。これは静かな欠落ではなく [Rust Core API](/ja/core/rust-api/#not-yet-implemented) に追跡されている後続 API です。

## 次へ

- [レンダリングモデル](/ja/core/rendering/)
- [Export profile](/ja/ecosystem/export-profiles/)
- [Migration と compatibility](/ja/ecosystem/compatibility/)
