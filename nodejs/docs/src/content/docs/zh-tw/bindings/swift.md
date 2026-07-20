---
title: Swift
description: Swift binding 的狀態與預期契約。
---

Swift 綁定是名為 `IllusionMarkdown` 的 Swift Package Manager 套件。它透過小型 C ABI 將所有解析與轉譯交給 `mdi-core`；Swift 不會包含語法或轉譯判斷。

在此 repository 開發時，`swift/Package.swift` 提供本地綁定配置。`Publish Swift Package` workflow 會把原生 Rust 函式庫建置並測試為 XCFramework、寫入 root `Package.swift`、建立 tag，並用 GitHub Actions 的內建 token 上傳 artifact。

它公開與其他語言相同的語法／IR 版本、診斷、UTF-8 位元組跨度與完整文件樹。`MDIParseResult.document` 使用無損的 `MDIJSONValue` 標記 JSON 值；跨度與診斷則使用 Swift 原生值型別。SwiftPM 發行套件是 `IllusionMarkdown`，import module 是 `MDI`。公開入口為 `parse`、`renderHTML`、`serialize`、`renderText`、`renderEPUB` 與 `renderDOCX`。
