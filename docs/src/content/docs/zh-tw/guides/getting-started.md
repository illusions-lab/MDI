---
title: 快速上手
description: 安裝 CLI 與 JavaScript 套件，把一份真正的 .mdi 檔案轉成 HTML、PDF 與純文字。
---

**先備知識：** [什麼是 MDI？](/zh-tw/learn/what-is-mdi/) 與[核心概念](/zh-tw/learn/core-concepts/) ―— 本頁假設你已經知道 IR、span、診斷是什麼。也需要 [Node.js](https://nodejs.org) 20 以上版本。

本頁實作的是 **MDI 2.0**，其規範性、人類可讀的定義是 [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)。以下每個指令與程式碼都可以直接複製貼上執行 ―— 全都對應本專案實際發布的套件，沒有任何空想成分。

## 1. 寫一份 `.mdi` 檔案

建立 `novel.mdi`：

```mdi
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
---

# 第一章

{雪女|ゆき.おんな}が現れたのは、第^12^話のことだった。
彼は[[em:決して]]忘れないと誓った。[[br]]
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

## 2. 用 CLI 轉換

全域安裝 CLI：

```bash
npm install --global @illusions-lab/mdi-cli
```

執行它：

```bash
mdi build novel.mdi --to html
```

```text
Written /path/to/novel.html
```

完整的指令形式，直接取自 CLI 自己的用法訊息：

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|note|txt-all [--config export.json] [-o <output>]
```

| 旗標 | 意義 |
| --- | --- |
| `--to <format>` | 必要。上述格式之一。 |
| `-o <path>` | 選用。輸出路徑。省略時，輸出檔會寫在輸入檔旁，使用該格式的副檔名 —— `novel.mdi --to pdf` 會寫出 `novel.pdf`；`--to txt-ruby` 會寫出 `novel_ruby.txt`（CLI 把文字變體命名為 `<stem>_<variant>.txt`，純 `txt` 則沒有後綴）。 |
| `--config <path>` | 選用。指向[匯出設定檔](/zh-tw/ecosystem/export-profiles/) JSON 檔的路徑，控制頁面大小、字型、邊界與文字縮排設定。 |

試試每一種輸出格式：

```bash
mdi build novel.mdi --to html                          # novel.html
mdi build novel.mdi --to pdf                            # novel.pdf
mdi build novel.mdi --to epub -o dist/novel.epub        # dist/novel.epub
mdi build novel.mdi --to docx                           # novel.docx
mdi build novel.mdi --to txt                            # novel.txt      ―— ruby 會被捨棄
mdi build novel.mdi --to txt-ruby                       # novel_ruby.txt ―— ruby 保留為 {base|reading}
mdi build novel.mdi --to narou                          # novel_narou.txt   ―— 小説家になろう 記法
mdi build novel.mdi --to kakuyomu                       # novel_kakuyomu.txt ―— カクヨム 記法
mdi build novel.mdi --to aozora                         # novel_aozora.txt  ―— 青空文庫 記法，以 Shift_JIS 編碼
mdi build novel.mdi --to note                           # novel_note.txt    ―— note 編輯器輸入，UTF-8
mdi build novel.mdi --to txt-all                        # 一次寫出全部六種文字檔；不接受 -o
```

### 每種格式實際會發生什麼事

- **HTML、TXT/`txt-ruby`/`narou`/`kakuyomu`/`aozora`/`note`、EPUB、DOCX** 全都**直接由 Rust 核心**渲染（`@illusions-lab/mdi` 的 `renderHtml`、`renderTextFormat`、`renderEpub`、`renderDocx`）―— CLI 中間不會重新剖析或重新詮釋任何東西。
- **PDF** 會把同一份 Rust 渲染出的 HTML 交給本機安裝的 Chromium 系瀏覽器，由它負責分頁並呼叫 `printToPDF`。Chromium 完全不會收到 `.mdi` 原始碼，也不做任何語法判斷。如果找不到 Chromium 系瀏覽器，指令會失敗並顯示指名缺少哪個相依項目的錯誤 —— 指定特定執行檔的方式請見[渲染模型](/zh-tw/core/rendering/)。
- **`aozora`** 輸出時會以 **Shift_JIS** 編碼，符合青空文庫自己投稿工具的期待格式；其他每種文字變體都以 UTF-8 寫出。

### 出錯時會怎樣

CLI 不會印出 stack trace。任何失敗都只會在 stderr 寫**一行**，並以結束碼 `1` 結束程序：

```bash
mdi build missing.mdi --to html
```

```text
ENOENT: no such file or directory, open 'missing.mdi'
```

```bash
mdi build novel.mdi --to svg
```

```text
Usage: mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|note|txt-all [--config export.json] [-o <output>]
```

無法識別的 `--to` 值（或任何其他格式錯誤的引數列）都會印出上面的用法訊息，而不是嘗試猜測你的意圖。

## 3. 用 JavaScript 剖析與渲染

如果你是在打造應用程式而不是呼叫 CLI，安裝主要套件：

```bash
npm install @illusions-lab/mdi
```

```js
import { readFile } from "node:fs/promises";
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = await readFile("novel.mdi", "utf8");

const { document, diagnostics, syntaxVersion, irVersion } = parse(source);
console.log(syntaxVersion, irVersion); // "2.0" "1.0"
console.log(diagnostics);              // 這份檔案是 [] ―— 沒什麼好警告的
console.log(document.frontmatter.entries);
// [{ key: "mdi", value: "2.0" }, { key: "title", value: "雪女" }, ...]

const html = renderHtml(source);
```

`parse` 完全不需要宿主端的 Markdown parser ―— CommonMark、GFM、front matter、MDI 全部在單一次 `parse` 呼叫裡決定。一般的格式錯誤會回傳可用的文件加上（通常是空的）診斷；`try`/`catch` 留給程式設計錯誤使用，例如傳入非字串：

```js
parse(42); // 丟出 TypeError: source must be a string
```

每個匯出函式（`renderEpub`、`renderDocx`、`renderText`、`renderTextFormat`、`serializeMdi`）的完整簽章與範例請見 [Bindings: JavaScript / TypeScript](/zh-tw/bindings/javascript/)。

## 4. Front matter 解說

`novel.mdi` 開頭的 front matter 區塊是普通的 YAML，在同一次 `parse()` 呼叫中被剖析：

```yaml
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
---
```

- `mdi` 聲明文件所針對的語法版本。省略時，剖析器會假設自己所支援的最新版本。若聲明的版本*新於*剖析器支援的版本，會得到一個 `mdi.version.unsupported` 警告診斷 ―— 剖析仍會以盡力而為的方式繼續進行（見[診斷](/zh-tw/core/diagnostics/)）。
- `writing-mode: vertical` 會改變 `renderHtml` 的排版方式（在根元素加上 `writing-mode: vertical-rl`），這也是縱中橫與傍點之所以存在的原因 ―— 兩者都是直排排版的裝置，在橫排下也能優雅地退化。
- 鍵的順序與未知的鍵都會保留在 `document.frontmatter.entries` 裡；renderer 對不認識的鍵不會報錯，只會忽略。

## 5. 選用：接上 `unified`/`remark` 管線

除非你已經有一套期待 `mdast` 節點的 `unified` 管線（例如 Astro、某個靜態網站產生器、以 `remark` 為基礎的檢查工具），否則可以跳過這一節。`@illusions-lab/mdi-remark` 是一個**adapter**，不是第二個剖析器 ―— 它呼叫的是同一個 Rust `parse()`，只是把結果重新整形成 `mdast`：

```js
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";

const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse(await readFile("novel.mdi", "utf8"));
```

哪些東西能正確往返轉換、哪些不行的完整細節，請見 [Remark / mdast adapter](/zh-tw/ecosystem/remark/)。

## 下一步

- [完整語法參考](/zh-tw/syntax/reference/) ―— 逐一解說上面 `novel.mdi` 用到的每個構文。
- [Rust 權威架構](/zh-tw/core/architecture/) ―— 「一份文法、一份實作」背後的所有權規則。
- [匯出設定檔](/zh-tw/ecosystem/export-profiles/) ―— 用 `--config` 控制頁面大小、字型、邊界。
