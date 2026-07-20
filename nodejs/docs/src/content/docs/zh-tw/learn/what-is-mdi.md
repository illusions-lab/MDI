---
title: 什麼是 MDI？
description: MDI 是為日本語組版設計的 Markdown ―― 單一 Rust 文法，處處輸出一致。
---

**先備知識：** 無。本頁假設你完全不認識 MDI，但已經懂一般 Markdown（`#` 標題、`*強調*`、`[連結](url)`）。

## 什麼是 MDI？

MDI（**illusion Markdown**，副檔名 `.mdi`）就是加了一小組日本語組版記法的一般 Markdown：**ruby**（振假名注音）、**縱中橫**（直排文字中把數字橫排）、**傍點**（圈點強調）、**割注**（行內雙行小字注記）、明確換行、分頁、區塊對齊，以及直排。

任何一般的 Markdown 文件本身就是合法的 MDI 文件 ―― MDI 只新增語法，不會移除或重新定義 CommonMark 或 GFM 的任何東西。`.mdi` 檔案就是普通的 UTF-8 純文字檔，位元組層級跟 `.md` 檔案毫無差異；副檔名只是慣例，剖析器並不會去檢查它。

```mdi
---
mdi: "2.0"
title: 雪女
lang: ja
writing-mode: vertical
---

# 第一章

{雪女|ゆきおんな}が現れたのは、第^12^話のことだった。
[[em:決して]]忘れない、と彼は思った。
```

把這個例子裡的 front matter 和 `{...}`／`^...^`／`[[em:...]]` 記法拿掉，剩下的就是一份普通的 Markdown 文件。這正是 MDI 的設計核心：**MDI 就是 Markdown，加上一組會優雅退回（不匹配時被忽略或視為純文字）的組版擴充。**

## MDI 為何存在

日文小說，特別是輕小說與網路小說，仰賴一批 CommonMark、GFM、Pandoc Markdown 都沒有記法可以表達的組版手法：

- 一個詞需要在旁邊或上方標註**讀音**，因為漢字本身可能有歧義或不常見（ruby）―― `{東京|とうきょう}`。
- 直排文字中的少數阿拉伯數字需要**直立橫排**，而不是一個字一行往下疊（縱中橫）―― `第^12^話`。
- 日文排版不用斜體表示強調，而是在文字旁加**圈點**（傍點）―― `[[em:それ]]`。
- 一段簡短的補充需要排成**行內雙行小字**，而不是腳注 ―― `[[warichu:注記]]`。
- 整份文件可能需要**直排、由右至左**（縱書き）排版，而非橫排。

現有工具大多是各自零散地解決這些問題：有些連載平台（Kakuyomu、Narou）發明了自己的括號記法；有些編輯器則各自外掛沒有共同文法的 Markdown 擴充。MDI 的貢獻是提供**單一規格**（`SYNTAX.md`）搭配**單一可執行實作**（`mdi-core` Rust crate），讓同一份 `.mdi` 檔案不論用什麼工具開啟 ―― 編輯器、CLI、網頁應用、出版流程 ―― 剖析結果都完全一致。

## MDI 與一般 Markdown 的關係

| | 一般 Markdown（CommonMark/GFM） | MDI |
| --- | --- | --- |
| 標題、清單、連結、表格、程式碼區塊、強調 | 有 | 有，未改變 |
| Front matter（`--- ... ---`） | 不屬於 CommonMark，各工具作法不一 | 有，並新增 MDI 專屬鍵（`writing-mode`、`page-progression`） |
| Ruby、縱中橫、傍點、割注、字距調整 | 沒有記法 | 有 |
| 明確換行 vs. 段落分隔 | 只有容易失效的行尾兩個空白硬換行 | `[[br]]`（明確不含糊） vs. 空行 |
| 直排 | 沒有這個概念 | Front matter 的屬性，因為它會影響多個構文的呈現方式 |
| 誰決定語法是否合法 | 取決於你用的函式庫 | 單一規格（`SYNTAX.md`）、單一實作（`mdi-core`） |

一份不含任何 MDI 構文的 `.md` 檔案，和一份不含任何 MDI 構文的 `.mdi` 檔案，呈現結果完全相同。差異只有在你用了 MDI 專屬記法時才會出現 ―― 即便如此，無效或有歧義的 MDI 記法也是設計成**退回為純文字**，而不是弄壞整份文件（每個構文頁面的「常見錯誤」一節都有精確的退回規則）。

## 從原始碼到輸出的完整流程

不論哪種語言，每個 MDI 工具都遵循同一條路徑：

```text
.mdi 原始碼（UTF-8 文字）
        │
        ▼
   mdi-core（Rust）── 一次剖析 CommonMark + GFM + front matter + MDI
        │
        ▼
版本化的文件 IR ── 帶標籤的樹狀結構；每個節點都有 UTF-8 byte span
        │
        ├──▶ renderHtml()        → HTML 字串
        ├──▶ renderText(format)  → TXT / なろう / カクヨム / 青空文庫 字串
        ├──▶ renderEpub()        → EPUB 3 位元組
        ├──▶ renderDocx()        → DOCX 位元組
        └──▶ renderHtml() + Chromium printToPDF → PDF 位元組
```

有兩點值得注意：

1. **剖析只在 Rust 裡發生一次。** 沒有任何一個 renderer 會重新讀取原始文字、重新判斷 ruby 範圍從哪裡開始 ―― 每個 renderer 都消費 `mdi-core` 早已建好的同一棵樹。
2. **PDF 就是「HTML 加上一個列印步驟」。** Rust 產生與瀏覽器所見完全相同的 HTML/CSS，再請本機安裝的 Chromium 系瀏覽器把這份 HTML 排版並呼叫 `printToPDF`。Chromium 從未讀取 `.mdi` 原始碼，也不做任何語法判斷 ―― 它只負責排版拿到的 HTML。Chromium 的職責邊界詳見[渲染模型與 Chromium/PDF 邊界](/zh-tw/core/rendering/)。

### 動手試試：原始碼 → HTML

以下是今天就能實際執行的真實 `@illusions-lab/mdi` JavaScript API：

```js
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = "{雪女|ゆきおんな}が第^12^話に現れた。";

const { document, diagnostics } = parse(source);
console.log(diagnostics); // [] ―― 這份原始碼沒有任何問題
console.log(document.children[0]); // 剖析後的段落節點，包含 MDI 的 ruby／縱中橫

console.log(renderHtml(source));
```

```html
<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>/* Rust 隨標記一併輸出的 .mdi-* 樣式表 */</style></head><body>
<p><ruby class="mdi-ruby">雪女<rp>（</rp><rt>ゆきおんな</rt><rp>）</rp></ruby>が第<span class="mdi-tcy">12</span>話に現れた。</p>
</body></html>
```

自行安裝 CLI 與 JavaScript 套件並實際執行的步驟，請見[快速上手](/zh-tw/guides/getting-started/)。

## 什麼時候該用 MDI？

- 你在寫需要 ruby、直排或傍點強調的日文小說（輕小說、網路小說、劇本），並想用純文字、易於版本控制的原始格式。
- 你想從**一份原始檔**產生 HTML（給網頁閱讀器）、EPUB（給電子書閱讀器）、DOCX（給出版社）、以及純文字（投稿到 Narou 或 Kakuyomu 等特定平台），而不必逐一手動編輯每種輸出。
- 你想要「同一份原始碼在編輯器、建置流程、CLI 中剖析結果完全一致」的保證 ―― 因為三者呼叫的是同一份 Rust 程式碼，而不是三套各自實作。

## MDI *不是*什麼

- **不是文書處理軟體或 WYSIWYG 格式。** MDI 是一種原始碼記法；DOCX/PDF 輸出是它的渲染結果，而不是反過來。
- **不是通用排版語言。** 它只涵蓋 `SYNTAX.md` 中列出的、具名的日本語組版手法 ―― 語法本身沒有「任意 CSS 屬性」這種通用逃生口。
- **不是每種語言都已實作。** Rust、JavaScript/TypeScript、Python 今天就能真的使用（`pip install illusion-markdown`）。Swift 目前仍是 **Planned**（規劃中，尚未動工）―― 在假設可以 `import` 之前，請先查看 [Bindings](/zh-tw/bindings/swift/) 的目前狀態。

## 下一步

- [核心概念](/zh-tw/learn/core-concepts/) ―― IR、診斷、span、capabilities 等詞彙，本站其他頁面都會用到。
- [快速上手](/zh-tw/guides/getting-started/) ―― 安裝 CLI 與 JavaScript 套件，跑出你的第一次轉換。
- [完整語法參考](/zh-tw/syntax/reference/) ―― 逐一解說每個 MDI 構文。
