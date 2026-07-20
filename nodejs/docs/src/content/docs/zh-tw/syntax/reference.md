---
title: 完整語法參考
description: 每個 MDI 2.0 構文 ―― 用途、語法、範例、剖析後的 IR、輸出，以及退回規則。
---

**先備知識：** [什麼是 MDI？](/zh-tw/learn/what-is-mdi/) 與[核心概念](/zh-tw/learn/core-concepts/)。

**規範**只有一份，就是 repository 裡的 [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) ―— 本頁每一條規則都直接取自那裡；兩者若有出入，以 `SYNTAX.md` 為準，本頁就是有 bug。英文版[完整語法參考](/syntax/reference/)以更詳細的十段式結構（用途 → 語法規則 → 最小範例 → 完整文件範例 → 解析後的 IR → 渲染輸出 → 常見錯誤 → 純文字退回規則 → 與一般 Markdown 的互動 → 直排／橫排差異）逐一說明每個構文。本頁把同樣的資訊濃縮成中文讀者能快速查閱的形式。

## 快速參考

| 功能 | 建議寫法 | 意義 |
| --- | --- | --- |
| Front matter | 以 `---` 包住的 YAML | 文件中繼資料與書寫方向 |
| Ruby | `{base\|reading}` | 為文字附加讀音 |
| 縱中橫 | `^12^` | 直排中的短橫排文字 |
| 傍點 | `[[em:text]]` | 圈點強調；`[[em:<mark>:text]]` 可指定符號 |
| 禁止斷行 | `[[no-break:text]]` | 不讓片語中途換行 |
| 換行 | `[[br]]` | 段落內的明確換行 |
| 空白段落 | `\`（單獨一行） | 一個刻意留白的段落 |
| 割注 | `[[warichu:text]]` | 行內雙行小字注記 |
| 字距調整 | `[[kern:-0.1em:text]]` | 明確調整字距 |
| 區塊對齊 | `[[indent:N]]` / `[[bottom]]` / `[[bottom:N]]` | 縮排，或對齊到行尾 |
| 分頁 | `[[pagebreak]]` / `[[pagebreak:left\|right]]` | 強制分頁邊界 |
| 腳注 | `[^id]` / `[^id]: text`（GFM） | 參照與定義注記 |
| 跳脫 | `\{` `\}` `\|` `\^` `\[` `\]` `\:` `\《` `\》` | 讓分隔字元變成純文字 |

## 1. Front matter

檔案開頭以 `---` 包住的 YAML 區塊。`writing-mode`（預設 `horizontal`）決定整份文件的書寫方向，會影響縱中橫、傍點、腳注的呈現方式，因此當成文件屬性而非 CSS 設定。`mdi` 鍵聲明目標版本；省略時視為剖析器支援的最新版本，若聲明版本新於支援範圍會出現 `mdi.version.unsupported` 警告，但不會拒絕整份文件（見[診斷](/zh-tw/core/diagnostics/#mdiversionunsupported)）。

```mdi
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
page-progression: rtl
---
```

`renderHtml` 會從 front matter 讀取 `lang`、`title`、`writing-mode`；只有 `writing-mode: vertical` 時才會在 `<html>` 加上 `style="writing-mode: vertical-rl;"`。**常見錯誤：** 忘記結尾的 `---`，整段就不是 front matter，而會被剖析成一般 Markdown（水平線加段落）。

## 2. Ruby（ルビ）

`{base|reading}`。讀音側加入 `.` 會依親字的書寫素叢集逐字分配讀音（**分割 ruby**，如 `{東京|とう.きょう}`）；不加點則整個讀音套用到整個親字上（**群組 ruby**，如 `{東京|とうきょう}`）。

```mdi
私は{雪女|ゆき.おんな}を見た。
```

```html
<ruby class="mdi-ruby">雪<rp>（</rp><rt>ゆき</rt><rp>）</rp>女<rp>（</rp><rt>おんな</rt><rp>）</rp></ruby>
```

**常見錯誤：** 分割點的段落數與親字的書寫素叢集數（像 `𠮟` 這種代理對漢字也算一個字）對不上，或有空區段時，會**自動退回成群組 ruby**（把點移除）―— 不會變成純文字。GFM 表格儲存格內要打 ruby 的 `|` 需寫成 `\|`（表格剖析比 MDI 早處理，所以最後仍是正常的 ruby）。親字與讀音兩側都是**純文字**，不會辨識巢狀語法。

## 3. 縱中橫（縦中横）

`^text^`。內容必須符合 `[0-9A-Za-z!?]{1,6}` ―— 半形英數字加 `!`/`?`，1 到 6 個字元。

```mdi
第^12^話。令和^7^年のことである。
```

```html
<span class="mdi-tcy">12</span>
```

`.mdi-tcy { text-combine-upright: all; }` 只在直排容器內生效，所以在橫排時同一份標記會自然失效（不需要重新剖析）。**常見錯誤：** 以為 `(^_^)` 這類字串會被誤判 ―— 字元集限制已排除這種情況，插入符仍是純文字。這跟 Pandoc 的 `^text^`（上標）無關，在 `.mdi` 裡永遠是縱中橫。

## 4. 傍點（傍點）

建議寫法：`[[em:text]]`（預設符號 ﹅）或 `[[em:<mark>:text]]`（`<mark>` 可以是任意一個字元）。相容寫法：`《《text》》`（Kakuyomu 記法，永遠使用預設符號）。

```mdi
彼は[[em:それ]]を見た。
[[em:●:決して]]忘れない。
```

```html
<span class="mdi-em" style="--mdi-em:&quot;﹅&quot;;">それ</span>
```

**常見錯誤：** 像 `[[em:dot]]` 這樣，第一個 `:` 之前不是剛好一個字元、或後面沒有第二個 `:`，就不算符號指定，整段內容會以預設符號當作文字（例如 `[[em:ab:cd]]` 會用預設符號標「ab:cd」）。`《《雪》考》` 這種內含 `《`/`》` 的別名寫法會**完全變成純文字**（用來保護書名號巢狀的情況）。括號巨集內容可以巢狀 ruby、縱中橫等 MDI 行內語法（`《《...》》` 內部除外，那裡是純文字）。

:::caution[目前實作狀態]
`SYNTAX.md` 規定了 `text-emphasis-position: over right`、`-webkit-text-emphasis`，以及避免符號在巢狀 ruby 上重複出現的 `.mdi-em rt { text-emphasis: none; }`。`@illusions-lab/mdi-to-hast`（本站自己使用的套件）的樣式表完全符合這些規定；但 `mdi-core` 自己內嵌在 `renderHtml` 裡的樣式表（CLI 的 `--to html` 使用的那份）目前是精簡版，不含上述宣告。HTML 元素結構本身相同。詳見[生態系：遷移與相容性](/zh-tw/ecosystem/compatibility/#stylesheet-parity)。
:::

## 5. 禁止斷行（改行抑止）

`[[no-break:text]]` ―— 避免專有名詞或固定片語在行尾被拆開。

```mdi
[[no-break:東京都新宿区]]に住んでいます。
```

```html
<span class="mdi-nobr">東京都新宿区</span>
```

**常見錯誤：** 內容為空（`[[no-break:]]`）時不會被辨識，整組括號會變成純文字。

## 6. 明確換行（改行マーカー）與換段

`[[br]]` 會在段落內換行，但仍留在同一個 `<p>` 裡。CommonMark 的空行會開始新段落 ―— MDI 沒有另外的換段記法。

```mdi
春は曙。[[br]]
やうやう白くなりゆく山ぎは。

夏は夜。
```

**常見錯誤：** 傳統的行尾兩個空白硬換行依然有效，但在複製貼上或編輯過程中很容易遺失，因此建議用 `[[br]]`。在 ruby 語法 `{base|ruby}` 內部、或程式碼區塊／行內程式碼內，`[[br]]` 會保留成純文字字串。

## 7. 空白段落（空白段落）

只含 `\` 的一行（符合 `^\\[ \t]*$`）就是一個空白段落，而且永遠是**區塊邊界**：即使前面沒有空行，也會結束當前段落。連續 N 行就是 N 個空段落。

```mdi
春は曙。
\
\
\
夏は夜。
```

```html
<p class="mdi-blank"></p>
```

**常見錯誤：** 在 `.md` 檔案中，單獨的 `\` 會被渲染成一個純文字反斜線 ―— 這個語意是 MDI 專屬的。`<br>`/`<br />` 單獨一行、或舊式的 `[[blank]]` 都是相容寫法，儲存時會正規化成 `\`。

:::caution[目前實作狀態]
`SYNTAX.md` 為 `.mdi-blank` 指定了邏輯屬性 `min-block-size: 1lh`，但 `mdi-core` 內嵌在 `renderHtml` 裡的樣式表用的是實體屬性 `min-height: 1em`。橫排時視覺差異很小，但直排時無法對應到正確的邏輯軸。詳見[遷移與相容性](/zh-tw/ecosystem/compatibility/#stylesheet-parity)。
:::

## 8. 割注（割注）

`[[warichu:text]]` ―— 在行內插入一段雙行小字注記。

```mdi
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

```html
<span class="mdi-warichu">六曜の一つで吉日とされる</span>
```

CSS 沒有原生的割注表現，`SYNTAX.md` 規定用 `display: inline-block` 的雙行換行來近似。像 InDesign 這類原生支援割注的輸出目標應該直接對應，而不是套用這個近似值。

:::caution[目前實作狀態]
`mdi-core` 內嵌在 `renderHtml` 裡的樣式表目前只有 `font-size: .6em`，不包含 `SYNTAX.md`／`mdi-to-hast` 規定的雙行換行近似（`display: inline-block` 等）。標記本身相同。
:::

## 9. 字距調整（字間調整）

`[[kern:<量>:<文字列>]]`。`<量>` 必須符合 `^[+-]?\d+(\.\d+)?em$`。

```mdi
彼は[[kern:-0.1em:確実]]にそう言った。
```

```html
<span class="mdi-kern" style="--mdi-kern:-0.1em;">確実</span>
```

**常見錯誤：** 像 `[[kern:0.1:text]]`（漏了 `em` 單位）這種無效數值，跟傍點不同，會讓**整個巨集**退回成純文字 ―— 因為字距調整沒有「不帶參數」的合理形式。

## 10. 區塊對齊（字下げ・地付き）

寫在目標段落**正上方、獨立一行**。`[[indent:N]]`（每行縮排 N 字）、`[[bottom]]`（地付き，對齊行尾）、`[[bottom:N]]`（從行尾上移 N 字）。巨集只套用到緊接著的一個區塊，不會疊加。

```mdi
[[indent:2]]
我輩は猫である。名前はまだ無い。

[[bottom]]
著者識
```

```html
<p class="mdi-indent" style="--mdi-indent:2;">我輩は猫である。名前はまだ無い。</p>
```

**常見錯誤：** `N` 為 0、負數或非整數，或後面沒有緊接段落，都會變成純文字。跟空白段落的 `\` 行一樣，區塊對齊巨集所在的那一行永遠是區塊邊界。

## 11. 分頁（改ページ）

以獨立一行的區塊形式書寫：`[[pagebreak]]`、`[[pagebreak:right]]`（改丁 —— 下一頁必須是右頁）、`[[pagebreak:left]]`（改丁 —— 下一頁必須是左頁）。

```mdi
第一章はここで終わる。

[[pagebreak]]

第二章が始まる。
```

`render_epub_document` 會在每個 `pagebreak` 節點另起一個 EPUB 章節檔；`render_docx_document` 會輸出原生的 OOXML 分頁（`<w:br w:type="page"/>`）。`recto`/`verso` 的 CSS 支援有限，EPUB/DOCX 匯出器會對應到各格式原生的分頁屬性。

## 12. 腳注（脚注）

直接繼承 GFM/Pandoc 的腳注語法，沒有 MDI 專屬記法。

```mdi
彼はその話を信じなかった[^1]。

[^1]: 後に事実と判明する。
```

橫排、直排目前都渲染成文件結尾的腳注（endnote）。`SYNTAX.md` 允許（但不要求）直排渲染器提供傍注（margin note）作為選項。

## 13. 跳脫（エスケープ）

在 `{` `}` `|` `^` `[` `]` `:` `《` `》` 前面加 `\`，該字元就會變成純文字。跳脫處理在所有 MDI 行內剖析**之前執行一次**。

```mdi
\{東京\|とうきょう\} \^12\^ \[\[br\]\] \《《文字\》》
```

→ `{東京|とうきょう} ^12^ [[br]] 《《文字》》`

**常見錯誤：** 在 GFM 表格儲存格內，`\|` 會在 MDI 跳脫處理之前，先被 GFM 自己的表格剖析消費掉。因此產生的 `|` 是一般字元，會參與 MDI 行內比對 ―— 這代表表格儲存格內的 ruby 語法裡，無法寫出*真正字面意義*的 `|`，必須移到表格外，或改變 ruby 的結構。

## 剖析順序

**區塊階段：** (1) front matter、(2) 標準 Markdown 區塊結構、(3) 空白段落行（`\`、`<br>`、`[[blank]]`）、(4) 區塊巨集（`[[pagebreak]]`、`[[indent:N]]`、`[[bottom]]`、`[[bottom:N]]`）。

**行內階段**（每個段落內部）：(5) 跳脫處理、(6) ruby、(7) `《《...》》` 傍點別名、(8) 縱中橫、(9) 括號巨集（`[[br]]`、`[[no-break:...]]`、`[[em:...]]`、`[[warichu:...]]`、`[[kern:...:...]]`）、(10) 腳注參照。

## 行內巢狀

括號巨集的內容會被剖析成 MDI 行內內容。`[[` / `]]` 的配對以計數方式巢狀，跳脫過的括號不計入（`[[em:foo[[no-break:bar]]baz]]` 中第一個 `]]` 關閉 `no-break`，第二個關閉 `em`）。Ruby、縱中橫、`《《...》》` 的內容都是純文字。HTML 輸出會自然地把對應元素巢狀起來；當傍點包住 ruby 時，`.mdi-em rt { text-emphasis: none; }` 會抑制讀音文字上重複出現的符號。

## TXT 匯出風格

`render_text_format`（Rust）與 CLI 的 `--to <flavor>` 實作了五種風格：

| 風格 | Ruby | 傍點 | 備註 |
| --- | --- | --- | --- |
| `txt`（純文字） | 捨棄 ―— 只留親字 | 捨棄 | 最簡單的匯出 |
| `txt-ruby` | 保留為 `{base\|reading}` | 保留純文字（符號捨棄） | 保留足夠資訊供之後重建 |
| `narou` | `｜base《reading》` | 逐字圈點 ruby（該站沒有傍點記法） | 小説家になろう 投稿格式 |
| `kakuyomu` | `｜base《reading》` | 原生 `《《text》》` 記法 | カクヨム 投稿格式，與 `narou` 只差在傍點那一列 |
| `aozora` | `base《reading》` | `text［＃「text」に傍点］` | 青空文庫注記慣例，由 CLI 重新編碼為 Shift_JIS |

某個風格沒有對應慣例的構文，會被扁平化成只留下內文文字、巨集直接捨棄。完整對應表請見 [CLI 頁面](/zh-tw/bindings/cli/#text-formats) 與 `SYNTAX.md` 的 TXT Export Flavors 一節。

## 下一步

- [即時渲染展示](/zh-tw/syntax/showcase/) ―— 上述每個構文都由本站即時渲染。
- [文件 IR](/zh-tw/core/document-ir/) ―— 完整的節點型別目錄。
- [遷移與相容性](/zh-tw/ecosystem/compatibility/) ―— 目前所有規範與實作的落差，集中在同一頁。
