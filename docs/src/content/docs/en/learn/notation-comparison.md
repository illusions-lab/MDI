---
title: Notation comparison
description: How MDI notation differs from DenDen Markdown, Narou, Kakuyomu, and Aozora Bunko.
---

An MDI manuscript is written as `{base|reading}` and converted into each destination's notation on export. This page lines MDI up with the notations in the [SYNTAX.md text-export table](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) and with DenDen Markdown's published syntax.

## Ruby, tate-chu-yoko, and emphasis marks

| | Ruby | Tate-chu-yoko | Emphasis marks |
| --- | --- | --- | --- |
| MDI | `{東京\|とうきょう}`. Split ruby uses dots: `{東京\|とう.きょう}` | `^12^` | `[[em:それ]]` |
| DenDen Markdown | `{電子出版\|でんししゅっぱん}`. Compound ruby splits on bars: `{電子出版\|でん\|し\|しゅっ\|ぱん}` | `^53^` | No dedicated syntax. In vertical layout the converter draws `*emphasis*` as emphasis dots |
| 小説家になろう | `｜東京《とうきょう》`. Base and reading are 1–10 characters, and `&"<>` are rejected | No notation; the inner text is kept | Per-character dot ruby: `｜そ《・》｜れ《・》` |
| カクヨム | `｜東京《とうきょう》`. Base up to 20 characters, reading up to 50 | No notation; the inner text is kept | `《《それ》》` |
| 青空文庫 | `｜東京《とうきょう》` | `12［＃「12」は縦中横］` | `［＃傍点］それ［＃傍点終わり］` |

DenDen ruby and tate-chu-yoko follow the [official syntax](https://conv.denshochan.com/markdown). Narou follows its [ruby](https://syosetu.com/helpcenter/helppage/helppageid/42/) and [emphasis-dot](https://syosetu.com/helpcenter/helppage/helppageid/43/) help, Kakuyomu its [notation help](https://kakuyomu.jp/help/entry/notation), and Aozora the [input manual](https://www.aozora.gr.jp/aozora-manual/index-input.html) plus the [annotation list](https://www.aozora.gr.jp/annotation/).

MDI splits ruby readings with dots. DenDen splits compound ruby with bars. When the number of segments does not match the base, both fall back to group ruby.

## Page breaks and vertical writing

MDI writes `[[pagebreak]]`, `[[pagebreak:left]]`, and `[[pagebreak:right]]`. Vertical writing for the whole document is the front-matter key `writing-mode: vertical`, which renderers apply as `writing-mode: vertical-rl`.

A DenDen page break is a line of three or more `=` signs, which splits the HTML file. Its syntax does not declare vertical writing for the whole document.

Narou and Kakuyomu plain text have no page-break notation and no document-level vertical-writing declaration. MDI export drops the page break and keeps only the inner characters of tate-chu-yoko. Aozora uses `［＃改ページ］`, `［＃改丁］`, and `［＃改見開き］`.

## Warichu

MDI writes `[[warichu:注記]]`. Narou and Kakuyomu have no equivalent, so export keeps the inner text. Aozora uses `［＃割り注］注記［＃割り注終わり］`. DenDen Markdown's syntax page does not define warichu.
