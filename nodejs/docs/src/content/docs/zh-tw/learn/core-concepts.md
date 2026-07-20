---
title: 核心概念
description: 文法、IR、span、診斷、capabilities ―― 每個 MDI 接口都共享的五個概念。
---

**先備知識：** [什麼是 MDI？](/zh-tw/learn/what-is-mdi/)

不論是 Rust crate、JavaScript 套件、Python 套件、CLI，還是未來的 Swift，每個 MDI 接口都共享同一組五個概念。在這裡學一次就好 ―— 本站其他每一頁（以及各 binding 自己的文件）都假設你已經懂這些詞的意思。

## 1. 一份文法，一份實作

`mdi-core`（Rust）是唯一能決定一段文字是不是 MDI 語法的程式碼。它每次都接收**整份 UTF-8 文件**，而不是片段 ―— 因為 MDI 的邊界取決於周圍的 Markdown 上下文。下面三行都含有子字串 `^12^`，只有看得到整行的 `mdi-core` 才知道哪個才是縱中橫：

```markdown
第^12^話                 ← 縱中橫：「12」會直立橫排
`^12^`                   ← 純文字 code span：這裡的 ^12^ 不生效
**第^12^話**              ← 在粗體強調裡，縱中橫仍然適用
```

任何其他語言或工具都不允許重新實作這個判斷。JavaScript、Python、Swift 套件可以呼叫 Rust、快取結果、或重新包裝成該語言慣用的型別 ―— 但不能擁有自己那一套 ruby／縱中橫／傍點文法規則。這就是「Rust 權威」具體的意思：如果兩個工具對「這是不是合法的 MDI」有不同答案，那一定是某處有 bug ―— 文法本來就只該有一份。

## 2. 文件 IR（中間表示法）

剖析產生的是一棵**樹**，不是已經套好樣式的輸出。這棵樹就叫 IR，也是每個 renderer 唯一消費的成品。對一份很小的文件呼叫 `parse()`，會拿到類似這樣的結果：

```json
{
  "irVersion": "1.0",
  "syntaxVersion": "2.0",
  "capabilities": { "mdi": true, "commonMark": true, "gfm": true, "frontMatter": true, "sourceSpans": true },
  "document": {
    "span": { "startByte": 0, "endByte": 21 },
    "children": [
      {
        "type": "paragraph",
        "span": { "startByte": 0, "endByte": 21 },
        "children": [
          { "type": "ruby", "base": "雪女", "ruby": { "type": "group", "value": "ゆきおんな" }, "span": { "startByte": 0, "endByte": 12 } }
        ]
      }
    ]
  },
  "diagnostics": []
}
```

有幾件事值得注意：

- **有兩個版本號。** `syntaxVersion`（"2.0"）是 MDI *語言*的版本 ―— 有哪些構文、各自代表什麼意思。`irVersion`（"1.0"）是*傳輸格式*的版本 ―— 也就是上面這個 JSON 的形狀。兩者獨立變動：未來 MDI 2.1 新增語法，IR 可能完全不變；反過來，即使 IR 做了破壞性重構，語法版本也可能不會跳。
- **CommonMark、GFM、MDI 共用一棵樹。** 不是先建一棵「Markdown 樹」再合併一棵「MDI 樹」―— 標題、連結、表格、ruby 節點在同一個結構裡互為兄弟或親子節點，因為 MDI 語法可以嵌在 Markdown 裡（反之亦然，見[行內巢狀](/zh-tw/syntax/reference/#行內巢狀)）。
- **每個源自原始碼的節點都帶有 `span`。** 這就是下一個概念。

完整節點目錄請見 [文件 IR](/zh-tw/core/document-ir/)。

## 3. span 是 UTF-8 位元組偏移，不是字元索引

`span.startByte` / `span.endByte` 是以原始來源字串的 **UTF-8 位元組**為單位的半開區間（`startByte` 包含在內，`endByte` 不包含）―— 不是 Unicode code point、不是 UTF-16 code unit（JavaScript 字串索引用的單位），也不是書寫素叢集（文字編輯器游標常用的單位）。

這在實務上很重要：「雪」是一個字，但在 UTF-8 裡是三個位元組。如果你在 JavaScript 環境（字串是 UTF-16）想在 `<textarea>` 裡標出一個 span，不能直接把 byte offset 當成字串索引用 ―— 必須轉換。MDI 選擇 byte offset 而不是某個語言原生的字串索引型別，理由是 byte offset 是唯一每種語言都能無歧義算出來的表示法；「字元索引」在你選定定義之前根本不是一個明確的概念（UTF-16 單位？code point？書寫素叢集？），MDI 不想把 JavaScript 或 Python 特有的選擇寫死進傳輸格式裡。

## 4. 診斷是資料，不是例外

**診斷（diagnostic）**回報的是可復原的問題 ―— 永遠是 `diagnostics` 陣列裡的一般物件，絕不會被丟成例外：

```json
{ "severity": "warning", "code": "mdi.version.unsupported", "message": "MDI 2.1 is newer than the supported 2.0", "span": { "startByte": 0, "endByte": 34 } }
```

`parse()` 幾乎不會丟例外。錯誤或有歧義的 MDI 語法（沒配對的 `^`、無效數值的 `[[kern:`、對不上的 ruby 分割點）都由每個構文自己的**純文字退回規則**處理（見[完整語法參考](/zh-tw/syntax/reference/)各節），通常連診斷都不會產生 ―— 這跟 Markdown 本身處理未知語法的寬容作法一致：保留成文字，別讓整份文件失敗。例外只保留給診斷描述不了的狀況：引數不是字串，或原生資源失敗（例如找不到 PDF 用的 Chromium）。目前完整的診斷代碼列表（目前恰好一個）請見[診斷與 UTF-8 原始碼 span](/zh-tw/core/diagnostics/)。

## 5. capabilities 描述的是「這一次剖析」，不是對未來的承諾

`capabilities` 是附在每個剖析結果上的一組布林值（`mdi`、`commonMark`、`gfm`、`frontMatter`、`sourceSpans`）。請檢查這個值，而不是假設某個功能一定存在 ―— 這正是早期、過渡階段的 JavaScript binding 用來告訴呼叫者「我只剖析了 MDI 專屬構文，還沒剖析完整 CommonMark」的機制，那時 Rust core 還沒長成一個完整的剖析器。今天每個 capability 都是 `true`，但這個欄位仍然存在，因為 IR 是明確版本化的，binding 不該去猜。

## 呈現方式是獨立的一層

以上談的都是**意義**―— 原始碼在說什麼。**外觀**（頁面大小、字型、某次輸出用的邊界、縮排方式）由另一個、更後面的步驟決定。那就是 [export profile](/zh-tw/ecosystem/export-profiles/)，它刻意無法改變文件*是什麼*，只能改變 renderer *怎麼排版它*。Renderer（`renderHtml`、`renderText`、`renderEpub`、`renderDocx`，以及透過 Chromium 的 PDF 路徑）消費的是 IR 加上 profile；Chromium 的職責從哪裡開始、到哪裡結束，詳見[渲染模型與 Chromium/PDF 邊界](/zh-tw/core/rendering/)。

## 下一步

- [文件 IR](/zh-tw/core/document-ir/) ―— 完整的節點型別目錄。
- [診斷與 UTF-8 原始碼 span](/zh-tw/core/diagnostics/) ―— 完整的診斷代碼表。
- [快速上手](/zh-tw/guides/getting-started/) ―— 用實際的 CLI 與 JavaScript API 實踐這些概念。
