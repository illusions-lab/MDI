---
title: 即時渲染展示
description: MDI 2.0 的全部語法，由本網站用 MDI 自己的解析器即時渲染。
---

下面每個範例都是**本文檔網站自己渲染出來的** — 頁面的 markdown 經過
`micromark-extension-mdi` + `mdast-util-mdi` 解析，輸出由
`@illusions-lab/mdi-to-hast` 附帶的樣式表裝飾。你看到的就是轉換器
實際產出的東西。

語法的正式定義在
[MDI 2.0 規範](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)；
本頁是展示，不是規範文本。

## ルビ（注音假名）

```
私は{雪女|ゆき.おんな}を見た。
{東京|とうきょう}は雨だった。
```

<div class="mdi-demo">

私は{雪女|ゆき.おんな}を見た。[[br]]
{東京|とうきょう}は雨だった。

</div>

`{底字|讀音}` 是群組 ruby；讀音裡的點（`ゆき.おんな`）會按底字逐字
拆分（mono ruby）。

## 縦中横

```
第^12^話。令和^7^年。^OK^。
```

<div class="mdi-demo mdi-demo-vertical">

第^12^話。令和^7^年。^OK^。

</div>

`^text^` 在直書中把 1–6 個英數字元轉正排列 — 所以這個示範框是直書的。
橫書時渲染為普通文字。

## 傍點

```
彼は[[em:それ]]を見た。
[[em:●:決して]]忘れない。
彼は《《それ》》を見た。（相容寫法）
```

<div class="mdi-demo">

彼は[[em:それ]]を見た。[[br]]
[[em:●:決して]]忘れない。[[br]]
彼は《《それ》》を見た。

</div>

預設符號是 ﹅；`[[em:<符號>:文字]]` 可指定任一單一字元作為符號。
`《《…》》` 是相容寫法，儲存時會正規化為 `[[em:…]]`。

## 禁止斷行

```
[[no-break:東京都新宿区]]に住んでいます。
```

<div class="mdi-demo">

[[no-break:東京都新宿区]]に住んでいます。

</div>

## 明示換行與空白段落

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

`[[br]]` 是段落內的明示換行；只有一個 `\` 的行是一個空白段落
（N 行 → N 個空白段落）。`[[blank]]` 和 `<br>` 是同一構文的相容寫法。

## 割注

```
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

<div class="mdi-demo">

その日は大安[[warichu:六曜の一つで吉日とされる]]であった。

</div>

## 字距調整

```
彼は[[kern:-0.1em:確実]]にそう言った。
[[kern:+0.3em:沈黙]]が落ちた。
```

<div class="mdi-demo">

彼は[[kern:-0.1em:確実]]にそう言った。[[br]]
[[kern:+0.3em:沈黙]]が落ちた。

</div>

## 縮排與靠底（字下げ・地付き）

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

`[[indent:N]]` 把接下來的區塊縮排 N 個字；`[[bottom]]` 靠行末對齊
（地付き），`[[bottom:N]]` 再往回移 N 個字。

## 分頁

```
第一章はここで終わる。

[[pagebreak]]

第二章が始まる。
```

分頁在螢幕上渲染為不可見的 `break-after: page` 標記 — 在分頁輸出
（PDF）中生效，在 EPUB 中切分 spine。`[[pagebreak:right]]` /
`[[pagebreak:left]]` 指定從右頁/左頁起始（改丁）。

## 行內巢狀

```
[[em:{東京|とうきょう}]]（傍點包住 ruby）
[[no-break:第^12^話]]（方括號巨集內的縦中横）
```

<div class="mdi-demo">

[[em:{東京|とうきょう}]][[br]]
[[no-break:第^12^話]]

</div>

## 跳脫字元

```
\{これはリテラルの中括弧\}、\^キャレット\^、\[角括弧\]。
```

<div class="mdi-demo">

\{これはリテラルの中括弧\}、\^キャレット\^、\[角括弧\]。

</div>

## 直書總合展示

<div class="mdi-demo mdi-demo-vertical">

私は{雪女|ゆき.おんな}を見た。第^12^話、令和^7^年のことである。彼は[[em:それ]]を[[no-break:決して]]忘れない。その日は大安[[warichu:六曜の一つで吉日とされる]]であった。

</div>

在實際輸出中，直書由 front matter（`writing-mode: vertical`）套用到
整份文件 — HTML 在根元素得到 `writing-mode: vertical-rl`，DOCX 得到
直書 section。
