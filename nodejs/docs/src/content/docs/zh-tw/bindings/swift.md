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
    .package(url: "https://github.com/illusions-lab/MDI.git", from: "2.0.2"),
]

// target 的 dependencies：
.product(name: "MDI", package: "MDI")
```

二進位套件支援 macOS 13+ 與 iOS 15+，包含 Apple Silicon 與適用的 Intel simulator。

## 解析與 IR

```swift
let result = try MDI.parse("# 見出し\n\n{東京|とうきょう}で第^12^話")
print(result.irVersion)          // "1.0"
print(result.diagnostics)
```

`result.document` 是無損的 `MDIJSONValue` 樹；可用 `.object`、`.array`、`.string`、`.number`、`.bool`、`.null` pattern matching 取用節點。`MDISourceSpan` 使用 UTF-8 byte offset。

## 轉譯

```swift
let html = try MDI.renderHTML("{東京|とうきょう} ^12^")
let mdi = try MDI.serialize("{東京|とうきょう} ^12^")
let text = try MDI.renderText("# Title")
let epub: Data = try MDI.renderEPUB("# Chapter")
let docx: Data = try MDI.renderDOCX("# Chapter")
```

EPUB 與 DOCX 回傳 ZIP 格式的 `Data`，請以對應副檔名寫入檔案。

## 錯誤與發布

所有 API 都會拋出 `MDIError`：`core` 表示 Rust core 的失敗，`invalidWireFormat` 表示無效或不支援的 native 回應。CI 會建置 XCFramework、跑 XCTest，並對 `swift/Sources/MDI` 強制 90% line coverage、上傳 Codecov；發版只使用 GitHub Actions 內建 token，不需要 PAT 或獨立倉庫。
