---
title: Swift
description: Planned：尚無 Swift package。本頁明確說明此事，只描述預期契約。
---

**狀態：Planned，未實作。**儲存庫的 [`swift/README.md`](https://github.com/illusions-lab/MDI/blob/main/swift/README.md) 完整寫道：*"Swift implementation of illusion Markdown (MDI). Not yet implemented."* 現在沒有 Swift package、XCFramework 或可安裝／呼叫的 public API。以下僅為預期，不能複製程式碼並期待它能 build。

## 這個綁定將解決什麼

它將提供[JavaScript](/zh-tw/bindings/javascript/)與[Rust](/zh-tw/bindings/rust/)現已提供的功能：從 Swift 解析、轉譯 `.mdi`，供 iOS/macOS reader、editor 等需要 in-process MDI 的情境使用。

## 安裝

沒有任何東西可安裝。加入 `illusions-lab/MDI` Swift package dependency 或同名 CocoaPod，今日都不是此 project 的真實 release。

## 預期最小範例（僅示意，今日不可編譯）

```swift
// ILLUSTRATIVE ONLY — this API does not exist yet.
import MDI
let source = try String(contentsOfFile: "novel.mdi", encoding: .utf8)
let result = try MDI.parse(source)
print(result.syntaxVersion, result.irVersion)
let html = try MDI.renderHTML(source)
```

## 預期 type mapping

預計用 [UniFFI](https://mozilla.github.io/uniffi-rs/) 或小型手寫 C ABI 包裝成 iOS/macOS XCFramework；同樣**不會**有 Swift-side grammar 重作，見[Rust-authoritative architecture](/zh-tw/core/architecture/)。`Document IR` node catalogue 應對應同欄位名的 Swift `struct`/`enum`；`MdiRubyReading` 的 `group`/`split` 應是含 associated values 的 Swift `enum`。byte spans 仍是 UTF-8 offsets；Swift `String.Index` 是 grapheme-cluster-based，實作必須明確定義轉換。

## 預期 error handling 與 version handling

普通 malformed MDI syntax 應如其他 binding：不 throw，保留 literal-fallback text 與少數 diagnostic。真正 programming/resource failure（例如 PDF 沒有 Chromium）才應透過 Swift `Error`/`throws` 提供。未來 binding 也應 expose `mdiSpecVersion`/`mdiIRVersion`，並拒絕不認識的 IR version。

## 目前實作狀態

**沒有任何部分已實作。**這不是 partial/in-progress binding；repository 中除了 placeholder README 沒有其他 source。變更時可留意 [`swift/`](https://github.com/illusions-lab/MDI/tree/main/swift)，屆時本頁會改為真實安裝與 API reference。

## 此綁定不做什麼

所有事都還不能做，因為沒有可運作程式碼。

## 下一步

- [JavaScript / TypeScript](/zh-tw/bindings/javascript/) 與 [Rust](/zh-tw/bindings/rust/)
- [Rust-authoritative architecture](/zh-tw/core/architecture/)
