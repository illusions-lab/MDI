---
title: HTML / TXT / EPUB / DOCX / PDF 出力
description: 各出力の意味、renderer、layout の担当範囲。
---

**前提:** [レンダリングモデル](/ja/core/rendering/)。すべて同じ [Document IR](/ja/core/document-ir/) の変換であり、別の syntax layer ではありません。

| Format | package | 実体 |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi` | embedded `.mdi-*` CSS を含む standalone HTML |
| TXT（5種） | `@illusions-lab/mdi` / CLI | plain、ruby-preserving、投稿サイト規約 text |
| EPUB | `@illusions-lab/mdi` | Rust が zip する EPUB 3 archive |
| DOCX | `@illusions-lab/mdi` | Rust が zip する OOXML document |
| PDF | `@illusions-lab/mdi-to-pdf` | Rust HTML/print CSS を local Chromium が layout |

PDF 以外の四形式は Rust 内で直接生成されます。CLI と JavaScript package に中間 JavaScript renderer はありません。PDF も native host の `render_pdf` / `find_chromium` を使い、Chromium は `.mdi` source ではなく完成 HTML/CSS だけを受け取ります。

## Legacy compatibility packages

`mdi-to-hast`、`mdi-to-html`、`mdi-to-epub`、`mdi-to-docx` は published のままです。これは legacy mdast/HAST path 向けで、CLI `build` は使用しません。`mdi-to-hast` の CSS は Rust `render_html` embedded CSS より `SYNTAX.md` に近い点があり、詳細は [stylesheet parity](/ja/ecosystem/compatibility/#stylesheet-parity) を参照してください。

EPUB/DOCX の cover、chapter split、page geometry/font の export-profile 対応は pending です。現在は front matter metadata のみを読みます。

## 次へ

- [レンダリングモデル](/ja/core/rendering/)
- [Export profile](/ja/ecosystem/export-profiles/)
