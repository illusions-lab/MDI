---
title: 診斷與 UTF-8 source spans
description: MDI 目前會發出的每個 diagnostic code，以及 byte span 的精確含義。
---

**先備知識：**[核心概念](/zh-tw/learn/core-concepts/#4-diagnostics-are-data-not-exceptions)。

## 形狀

```ts
interface MdiDiagnostic { severity: "warning" | "error"; code: string; message: string; span?: MdiSourceSpan; // { startByte: number; endByte: number } }
```

診斷存在 parse result 的 `diagnostics` array，永遠是資料，不會以 exception 丟出。大多數 MDI 文件的 array 為空；錯誤或含糊的 MDI 記號由各 construct 的**字面備援規則**處理（每個 construct 都記載於 [syntax reference](/zh-tw/syntax/reference/)），而不是產生 diagnostic。這與 Markdown 處理不認識語法相同：保留成文字，不讓整份文件失敗。

## 今天所有 diagnostic code

`mdi-core` 目前只有**一個** diagnostic code：

### `mdi.version.unsupported`

- **Severity：**`warning`
- **觸發時機：**front matter 宣告的 `mdi:` version string 大於 crate 的 `MDI_SPEC_VERSION`（今日為 `"2.0"`）。
- **Span：**整個 front-matter block。
- **Message shape：**`"MDI {declared} is newer than the supported {MDI_SPEC_VERSION}"`。

```mdi
---
mdi: "2.1"
---

本文。
```

```json
[{ "severity": "warning", "code": "mdi.version.unsupported", "message": "MDI 2.1 is newer than the supported 2.0", "span": { "startByte": 0, "endByte": 15 } }]
```

依 `SYNTAX.md`，遇到高於支援版本時是**SHOULD 警告並繼續**，絕非 **MUST 拒絕**；parser 以已知規則盡力處理，仍產出正常 tree 與此 diagnostic。

:::caution[目前實作狀態]
`mdi-core` 現在使用一般**字串**比較（`declared > MDI_SPEC_VERSION`），不是 semantic-version 比較。當 MDI 維持單位數 `major.minor` 時實際案例都正確，但一般而言不具 semver awareness，例如 `"2.10"` 在字典序會小於 `"2.9"`。這是目前實作限制，並非規範的 version-comparison rule。
:::

以上就是完整清單。無效 kern amount 或 split-ruby segment 不匹配等情況沒有 diagnostic；設計上它們以字面備援靜默處理，請見 [syntax reference](/zh-tw/syntax/reference/)。

## Spans，精確來說

- **單位：**傳給 `parse()` 的精確 source string 的 UTF-8 bytes。
- **範圍：**half-open；`startByte` 包含、`endByte` 不包含；相減即 span text 的 byte length。
- **不是：**Unicode code point、UTF-16 code unit（JavaScript 的字串索引），也不是 grapheme cluster（通常是 editor cursor 位置）。

### 將 byte span 轉為 JavaScript string index

```js
function byteSpanToUtf16Index(source, byteOffset) {
  const bytes = new TextEncoder().encode(source);
  const prefix = new TextDecoder().decode(bytes.subarray(0, byteOffset));
  return prefix.length;
}
```

此 round-trip（整串 encode 一次、decode byte prefix、取 length）是最簡單的正確做法；不要以字元數近似，因為 BMP 以外 codepoint（許多 emoji、部分漢字）具有不同的 UTF-16 unit 與 byte 數。

## 下一步

- [完整 syntax reference](/zh-tw/syntax/reference/)
- [Document IR](/zh-tw/core/document-ir/)
