---
title: Swift
description: 使用 Swift Package Manager 安裝與使用 MDI。
---

`IllusionMarkdown` 是 MDI 的 Swift Package Manager 發行套件；產品與 import module 都叫作 `MDI`：

```swift
import MDI
```

Swift 會透過精簡的 C ABI 將解析和轉譯交給 Rust 的 `mdi-core`，不會重作語法，因此所有綁定共用同一份語法、文件 IR、診斷與 renderer。

## 安裝

在 `Package.swift` 加入相依套件，並讓使用它的 target 相依於 `MDI` 產品：

```swift
dependencies: [
    .package(url: "https://github.com/illusions-lab/MDI.git", from: "2.0.3"),
]

// target 的 dependencies：
.product(name: "MDI", package: "MDI")
```

二進位套件支援 macOS 13+ 與 iOS 15+，包含 Apple Silicon 與適用的 Intel simulator。

## 解析與 IR

```swift
let result = try MDI.parse("# 見出し\n\n{東京|とうきょう}で第^12^話")
print(result.irVersion)          // "1.0"
print(result.capabilities.mdi)   // true
print(result.diagnostics)
```

`result.document` 是無損的 `MDIJSONValue` 樹；可用 `.object`、`.array`、`.string`、`.number`、`.bool`、`.null` pattern matching 取用節點。`MDISourceSpan` 使用 UTF-8 byte offset。

## 轉譯與序列化

```swift
let html = try MDI.renderHTML("{東京|とうきょう} ^12^")
let mdi = try MDI.serialize("{東京|とうきょう} ^12^")
let text = try MDI.renderText("# Title")
let note = try MDI.renderTextFormat(
    "# Title\n\n{東京|とうきょう}",
    format: .note
)
let epub: Data = try MDI.renderEPUB("# Chapter")
let docx: Data = try MDI.renderDOCX("# Chapter")
```

`MDITextFormat` 提供與其他綁定相同的六種 Rust 格式：`plain`、`ruby`、
`narou`、`kakuyomu`、`aozora` 與 `note`。
EPUB 與 DOCX 回傳 ZIP 格式的 `Data`，請以對應副檔名寫入檔案。

## 錯誤

所有公開 API 都可能拋出 `MDIError`：`MDIError.core` 表示 Rust core 回傳的失敗，`MDIError.invalidWireFormat` 表示無效或不支援的 native 回應。

```swift
do {
    let html = try MDI.renderHTML(source)
    print(html)
} catch let error as MDIError {
    print(error.localizedDescription)
}
```

## 開發與發布

repository 的 `swift/Package.swift` 是本機開發用 package。CI 會建置 XCFramework、跑 XCTest，並對 `swift/Sources/MDI` 強制 95% line coverage、上傳 Codecov。release workflow 會建立 manifest pull request；該 PR 合併後才發布核准的 artifact。它使用 GitHub Actions 內建 token，不需要 PAT 或第二個 repository。

## 自動割注排版

分割規則由 Rust 統一實作。固定兩行、正文50%字級、零小行間距。首個片段可使用正文行剩餘容量，後續片段使用完整行容量。容量與回傳寬度以割注字級的半個em為單位；這是字寬估算，不保證比例字型的精確均衡。

```swift
let fragments = try MDI.layoutWarichu(
    [.object(["type": .string("text"), "value": .string("一二三四五六")])],
    capacity: 4, firstCapacity: 2)
```

結果包含 `lines`、`html`、`widths`、`overflow`、`hardBreakAfter` 與 `sources`。`path` 是從輸入陣列起算的子節點索引路徑；`startUtf8` / `endUtf8` 是可見文字中的半開UTF-8位元組範圍。相同 `group` 保留跨格式邊界的書寫素。Ruby、縱中橫及no-break保持不可拆。作者硬換行保留，自動分割不寫回canonical MDI或純文字。靜態HTML/EPUB的閱讀器重排結果可能不同。DOCX使用原生雙行群組；XML與匯入器檢查不代表Word實測。
