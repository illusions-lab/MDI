---
title: 架構
description: Rust 是 MDI 唯一的可執行語法權威；各語言套件只提供薄介面。
---

一份 `.mdi` 文件的完整語義全部由 Rust 決定。`mdi-core` 解析 CommonMark、
GFM、front matter 與 MDI，產生有明確版本、與程式語言無關的文件 IR。JavaScript、
Python、Swift 等套件只負責把同一套 Rust 實作接到各自的生態系。

:::caution 目前實作狀態
以上是產品契約目標。目前 Rust API 請看[Rust Core API 狀態](/zh-tw/core/rust-api/)。Node CLI 與輸出 package 仍有過渡中的 TypeScript mdast/HAST 路徑，但它們不是另一個語法權威。
:::

## 語法權威

MDI 有三項互相補足的事實來源：

1. [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)
   是供人閱讀的規範性語言規格。
2. `mdi-core` 是這份規格唯一的可執行實作。
3. 共用的 conformance fixtures 定義可觀察的語法樹、diagnostics 與輸出結果。

JavaScript、Python、Swift、CLI、編輯器與 renderer 都不得自行辨認、修復或驗證
MDI 語法。Ruby 分組、巢狀 macro 邊界、escape 與合法 `kern` 數值等規則只在
Rust 實作一次。

## 系統架構

```text
                               .mdi 原始碼
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │ mdi-core                    │
                    │ CommonMark + GFM + MDI      │
                    │ front matter + diagnostics  │
                    └──────────────┬──────────────┘
                                   │
                           有版本的 MDI 文件 IR
                                   │
             ┌─────────────────────┼──────────────────────┐
             │                     │                      │
             ▼                     ▼                      ▼
       Rust renderers         各語言 bindings        生態系 adapters
       MDI/TXT/HTML/           JS/Python/Swift         mdast/remark
       EPUB/DOCX               （不含語法）            （不含語法）
             │
             └── HTML + 列印 CSS ──▶ Chromium ──▶ PDF
```

`mdi-core` 必須解析完整文件，因為 MDI 的邊界取決於 Markdown 上下文，不能在隔離
的文字片段上安全地進行第二次掃描：

```markdown
`^12^`                 <!-- code 裡保持純文字 -->
**第^12^話**           <!-- strong 裡可以有 MDI -->
[[em:**重要**]]        <!-- MDI 結構裡可以有 Markdown -->
```

因此，CommonMark、GFM、front matter 與 MDI 構成一套由 Rust 掌管的文法，
並產生同一棵語法樹。

## `mdi-core` 契約

原生 Rust API 與所有語言綁定都提供相同概念的功能：

```text
parse(source, options) -> ParseResult
validate(document, options) -> diagnostics
normalize(document, options) -> document
serializeMdi(document, options) -> string
renderHtml(document, profile) -> string
renderText(document, flavor, profile) -> string
renderEpub(document, profile) -> bytes
renderDocx(document, profile) -> bytes
renderPdf(document, profile) -> bytes
```

`parse` 接收完整的 UTF-8 原始碼，不需要宿主語言提供 Markdown parser。一般的
格式錯誤會產生可用的語法樹與 diagnostics；只有程式設計錯誤或系統資源不可用
才會拋出 exception。

### 文件 IR

公開 IR 與程式語言無關，並具有明確的 schema 版本。其內容包括：

- MDI 語法版本與 IR schema 版本；
- 位於同一棵樹中的 CommonMark、GFM、front matter 與 MDI 型別化 nodes；
- 每個源自輸入內容的 node 所對應的半開 UTF-8 byte span；
- 保留原始順序與未知 keys 的 front matter；
- 文件 metadata 與 footnote 關係；
- 具有穩定代碼、嚴重程度與來源位置的可恢復 diagnostics；
- 足以支援標準化 `.mdi` 序列化及編輯器功能的來源資訊。

Block model 包含 paragraph、heading、block quote、list、code、thematic break、
HTML、table、footnote definition、blank paragraph、page break 與 block
alignment。Inline model 包含 text、emphasis、strong、deletion、link、image、
code、HTML、footnote reference、line break、ruby、縱中橫、傍點、no-break、
warichu 與 kerning。

Rust enum 是內部實作細節。FFI 交換的是穩定的 wire representation，各語言
綁定再將它轉成慣用的宿主物件。若 wire schema 發生不相容變更，IR 版本也必須
提升。

### 解析不變條件

- Code span、fenced code 與 raw context 中看似 MDI 的內容保持純文字。
- `SYNTAX.md` 允許時，MDI container 裡可以巢狀使用 CommonMark。
- 符合條件的 CommonMark inline container 裡可以出現 MDI node。
- 無效或未配對的 MDI delimiter 依 `SYNTAX.md` 的規則退回純文字，也可以產生
  diagnostic。
- 所有 offset 都是相對於原始輸入的 UTF-8 byte offset。
- 相同的原始碼與選項在每個平台都必須產生相同的 IR 與 diagnostics。

## 輸出

所有可重現的轉換都在 Rust 中完成：

| 輸出 | 實作方式 |
|---|---|
| 標準化 MDI | Rust serializer |
| 各種 TXT | Rust renderer |
| HTML | Rust HTML/CSS renderer |
| EPUB | Rust XHTML、metadata、CSS 與 ZIP packager |
| DOCX | Rust OOXML 與 ZIP packager |
| PDF | Rust HTML/列印 CSS renderer 與 Chromium controller |

PDF 刻意使用 Chromium 作為排版引擎。Rust 尋找或接收 Chromium 執行檔、啟動
隔離的 process、透過 Chrome DevTools Protocol 呼叫 `printToPDF`，並回傳 PDF
bytes。日文直書、ruby、縱中橫、傍點、字型 shaping 與分頁由 Chromium 負責；
Chromium 不解析 MDI，也不決定文件語義。

瀏覽器中的 WebAssembly 無法啟動 process。解析與可重現的 renderer 仍在本機
執行；PDF 則由後端或桌面 host 透過同一個 Rust PDF API 產生。

## 各語言綁定與 adapters

| 宿主環境 | 介面 |
|---|---|
| Rust | 原生 crate API |
| 瀏覽器 JavaScript | WebAssembly |
| Node.js | 遵循相同 wire contract 的原生或 WebAssembly binding |
| Python | PyO3 |
| Swift | UniFFI，或封裝成 XCFramework 的小型 C ABI |

綁定可以轉換字串、bytes、errors、options 與物件形狀，但不得包含 grammar
tables、tokenizer、語法 fallback 或 renderer 語義。

Remark 是選用的生態系 adapter。它在 Rust 文件 IR 與 mdast 之間進行映射，
讓 unified plugins 能參與工作流程，但不解析 MDI，也不改變任何 MDI 邊界判定。
主要 JavaScript API 直接呼叫 Rust，不依賴 remark。

## 合規條件

一項實作只有在符合下列所有條件時，才屬於 MDI 的一部分：

- 每個語法入口都把完整原始碼交給 `mdi-core`；
- 所有公開解析結果都聲明所使用的語法版本與 IR 版本；
- 每個語言綁定都原樣通過共用的解析及 diagnostic fixtures；
- 每個可重現的 renderer 都以 Rust IR 為輸入；
- PDF 使用由 Rust IR 產生的 HTML/CSS，並由 Rust 負責協調；
- 宿主語言套件中不存在另一套 MDI tokenizer 或 parser。

完整契約見 repository 根目錄的
[`ARCHITECTURE.md`](https://github.com/illusions-lab/MDI/blob/main/ARCHITECTURE.md)。
