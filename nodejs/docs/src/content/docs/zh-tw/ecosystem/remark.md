---
title: Remark / mdast adapter
description: @illusions-lab/mdi-remark：將 Rust-authoritative MDI parse result 接入 unified/remark。
---

**先備知識：**[Rust-authoritative architecture](/zh-tw/core/architecture/)、[Document IR](/zh-tw/core/document-ir/)。

## 這個 package 解決什麼

`@illusions-lab/mdi-remark` 讓使用 unified/remark 的工具取得 MDI parser 產生的 `mdast` tree。它不是另一個 parser：完整 source 交給同一份 Rust `mdi-core`，再把 versioned Document IR 轉成 mdast；因此不會有 JavaScript grammar 或與 CLI 不同的 syntax decision。

## 安裝與使用

```bash
npm install unified remark-parse @illusions-lab/mdi-remark
```

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import { remarkMdi } from "@illusions-lab/mdi-remark";

const tree = unified().use(remarkParse).use(remarkMdi).parse("{東京|とうきょう}");
```

將其放在 pipeline 中以便後續 rehype、lint 或其他 unified plugin 消費 MDI-aware mdast。實際 option 與 package export 請以 published package type/source 為準。

## MDI 到 mdast 的 mapping

一般 CommonMark/GFM node 為一般 mdast node；MDI constructs 會以 adapter 定義的 node/data 表示，保留可供下游 renderer 使用的語意。source position 從 Rust UTF-8 byte spans 轉換而來；consumer 應了解原始 IR span 單位仍是 bytes，詳見[診斷](/zh-tw/core/diagnostics/)。

## 目前實作狀態：今日僅單向

**MDI → mdast 已實作。**反向則不是完整 MDI authoring/serialization contract：將已編輯 mdast tree 寫回 `.mdi` 不會經過 Rust `serialize_mdi` 的 recommended-form normalization，例如 `《《text》》` 轉成 `[[em:text]]`。需要 canonical MDI output 時使用 Rust/JavaScript 的 `serializeMdi`，不是假設 mdast stringify 做到相同事。

## 此 adapter 不做什麼

- **不解析自己的 MDI grammar。**所有 syntax authority 都在 Rust。
- **不是雙向 editor API。**沒有保證 mdast 修改後可 lossless/canonical round-trip 成 `.mdi`。
- **不取代 Rust renderers。**CLI 的 HTML/TXT/EPUB/DOCX 使用 Rust renderer；adapter path 是給 unified ecosystem 的選項。

## 下一步

- [輸出格式](/zh-tw/ecosystem/outputs/)
- [Migration 與 compatibility](/zh-tw/ecosystem/compatibility/)
- [JavaScript 綁定](/zh-tw/bindings/javascript/)
