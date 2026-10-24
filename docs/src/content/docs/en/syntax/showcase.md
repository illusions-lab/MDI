---
title: Live Showcase
description: Every MDI 2.0 construct, parsed by mdi-core and rendered live by this site.
---

Every example below is **rendered by this documentation site itself**. The
complete page source is parsed by Rust through `@illusions-lab/mdi`, and the
resulting document IR is rendered with the same HTML semantics exposed to
applications. What you see is what the MDI renderer produces.

The full syntax definition lives in the
[MDI 2.0 specification](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md);
this page is a demonstration, not the normative reference.

## Ruby（ルビ）

```
私は{雪女|ゆき.おんな}を見た。
{東京|とうきょう}は雨だった。
```

<div class="mdi-demo">

私は{雪女|ゆき.おんな}を見た。[[br]]
{東京|とうきょう}は雨だった。

</div>

`{base|reading}` is group ruby; dots in the reading (`ゆき.おんな`) split it
per base character (mono ruby).

## Tate-chu-yoko（縦中横）

```
第^12^話。令和^7^年。^OK^。
```

<div class="mdi-demo mdi-demo-vertical">

第^12^話。令和^7^年。^OK^。

</div>

`^text^` composes 1–6 alphanumeric characters upright within vertical text —
which is why this demo box is vertical. In horizontal writing it renders as
plain text.

## Boten（傍点）

```
彼は[[em:それ]]を見た。
[[em:●:決して]]忘れない。
彼は《《それ》》を見た。（compatibility alias）
```

<div class="mdi-demo">

彼は[[em:それ]]を見た。[[br]]
[[em:●:決して]]忘れない。[[br]]
彼は《《それ》》を見た。

</div>

The default mark is ﹅; `[[em:<mark>:text]]` sets any single character as the
mark. `《《…》》` is a compatibility spelling that normalizes to `[[em:…]]`
on save.

## No-break（改行抑止）

```
[[no-break:東京都新宿区]]に住んでいます。
```

<div class="mdi-demo">

[[no-break:東京都新宿区]]に住んでいます。

</div>

## Explicit line break & blank paragraphs

```
春は曙。[[br]]
やうやう白くなりゆく山ぎは。

夏は夜。

\
\

秋は夕暮れ。
```

<div class="mdi-demo">

春は曙。[[br]]
やうやう白くなりゆく山ぎは。

夏は夜。

\
\

秋は夕暮れ。

</div>

`[[br]]` is an explicit in-paragraph line break; a line containing only `\`
is one blank paragraph (N lines → N blank paragraphs). `[[blank]]` and
`<br>` are compatibility spellings of the same construct.

## Warichu（割注）

```
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

<div class="mdi-demo">

その日は大安[[warichu:六曜の一つで吉日とされる]]であった。

</div>

## Kerning（字間調整）

```
彼は[[kern:-0.1em:確実]]にそう言った。
[[kern:+0.3em:沈黙]]が落ちた。
```

<div class="mdi-demo">

彼は[[kern:-0.1em:確実]]にそう言った。[[br]]
[[kern:+0.3em:沈黙]]が落ちた。

</div>

## Block alignment（字下げ・地付き）

```
[[indent:2]]
我輩は猫である。名前はまだ無い。

[[bottom]]
著者識

[[bottom:2]]
令和七年七月
```

<div class="mdi-demo">

[[indent:2]]
我輩は猫である。名前はまだ無い。

[[bottom]]
著者識

[[bottom:2]]
令和七年七月

</div>

`[[indent:N]]` indents the following block by N em; `[[bottom]]` aligns it to
the line end (地付き), `[[bottom:N]]` with an N-em shift.

## Page break（改ページ）

```
第一章はここで終わる。

[[pagebreak]]

第二章が始まる。
```

Page breaks render as invisible `break-after: page` markers on screen — they
take effect in paged output (PDF) and split the spine in EPUB.
`[[pagebreak:right]]` / `[[pagebreak:left]]` request recto/verso openings
(改丁).

## Inline nesting

```
[[em:{東京|とうきょう}]]（boten wrapping ruby）
[[no-break:第^12^話]]（tate-chu-yoko inside a bracket macro）
```

<div class="mdi-demo">

[[em:{東京|とうきょう}]][[br]]
[[no-break:第^12^話]]

</div>

## Escapes

```
\{これはリテラルの中括弧\}、\^キャレット\^、\[角括弧\]。
```

<div class="mdi-demo">

\{これはリテラルの中括弧\}、\^キャレット\^、\[角括弧\]。

</div>

## Vertical writing, all together（縦書き総合）

<div class="mdi-demo mdi-demo-vertical">

私は{雪女|ゆき.おんな}を見た。第^12^話、令和^7^年のことである。彼は[[em:それ]]を[[no-break:決して]]忘れない。その日は大安[[warichu:六曜の一つで吉日とされる]]であった。

</div>

In real output, vertical writing is driven by the front matter
(`writing-mode: vertical`), which the converters apply document-wide — HTML
gets `writing-mode: vertical-rl` on the root element, DOCX a vertical section.
