---
title: HTML / TXT / EPUB / DOCX / PDF 出力
description: 各出力の意味、renderer、layout の担当範囲。
---

**前提:** [レンダリングモデル](/ja/core/rendering/)。すべて同じ [Document IR](/ja/core/document-ir/) の変換であり、別の syntax layer ではありません。

| Format | package | 実体 |
| --- | --- | --- |
| HTML | `@illusions-lab/mdi` (`renderHtml`) | embedded `.mdi-*` CSS を含む standalone HTML |
| TXT（6種） | `@illusions-lab/mdi` (`renderTextFormat`) / CLI | plain、ruby-preserving、投稿サイト規約 text。[note 書き出し](/ja/ecosystem/note/) を含む |
| EPUB | `@illusions-lab/mdi` (`renderEpub`) | reflowable XHTML、`nav.xhtml`、CSS、OPF を Rust が zip する EPUB 3 archive |
| DOCX | `@illusions-lab/mdi` (`renderDocx`) | Rust が zip する OOXML（WordprocessingML）document |
| PDF | `@illusions-lab/mdi-to-pdf` | Rust HTML/print CSS を local Chromium が layout |

PDF 以外の四形式は、profile 設定付き EPUB/DOCX も含めて Rust 内で直接生成されます。CLI と JavaScript package は argument を整えるだけで、中間 JavaScript renderer はありません。PDF は Rust が解決した profile と準備済み HTML/print CSS を使い、native または Node host が Chromium を起動します。

## Legacy compatibility packages

`mdi-to-hast`、`mdi-to-html`、`mdi-to-epub`、`mdi-to-docx` は published のままです。既に `mdast`/HAST tree を持つ unified consumer のための compatibility entry で、EPUB/DOCX は tree を MDI に serialize して最終生成を Rust に委ねます。独立した archive generator は残していません。CLI `build` はこの tree-facing entry を使いません。`mdi-to-hast` の CSS は Rust `render_html` embedded CSS より `SYNTAX.md` に近い点があり、詳細は [stylesheet parity](/ja/ecosystem/compatibility/#stylesheet-parity) を参照してください。

## Profile 設定付き output

設定付き EPUB は metadata、writing mode、typography、chapter split、
PNG/JPEG cover を扱います。設定付き DOCX は metadata、page geometry、
mirror margin、writing mode、typography、strict／flowing grid、page number
を扱います。どちらも Rust で同じ [Export profile](/ja/ecosystem/export-profiles/)
を解決するため、将来 Python、Swift、Android に公開するときも同じ処理を
書き直す必要はありません。

## 次へ

- [レンダリングモデル](/ja/core/rendering/)
- [Export profile](/ja/ecosystem/export-profiles/)
- [Migration と compatibility](/ja/ecosystem/compatibility/)
