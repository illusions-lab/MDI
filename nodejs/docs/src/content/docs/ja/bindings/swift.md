---
title: Swift
description: Swift Package Manager で MDI をインストールして使用する。
---

`IllusionMarkdown` は MDI の Swift Package Manager 配布名です。product と import module はどちらも `MDI` です。

```swift
import MDI
```

Swift は小さな C ABI を通じて Rust の `mdi-core` に解析とレンダリングを委譲します。文法を再実装しないため、全バインディングで同じ構文、document IR、diagnostics、renderer を共有します。

## インストール

`Package.swift` に依存関係を追加し、使用する target に `MDI` product を追加します。

```swift
dependencies: [
    .package(url: "https://github.com/illusions-lab/MDI.git", from: "2.0.2"),
]

// target の dependencies:
.product(name: "MDI", package: "MDI")
```

バイナリパッケージは macOS 13+、iOS 15+、Apple Silicon、および該当する Intel simulator をサポートします。

## 解析と IR

```swift
let result = try MDI.parse("# 見出し\n\n{東京|とうきょう}で第^12^話")
print(result.irVersion)          // "1.0"
print(result.diagnostics)
```

`result.document` は可逆な `MDIJSONValue` ツリーです。`.object`、`.array`、`.string`、`.number`、`.bool`、`.null` の pattern matching で node を扱えます。`MDISourceSpan` は UTF-8 byte offset です。

## レンダリング

```swift
let html = try MDI.renderHTML("{東京|とうきょう} ^12^")
let mdi = try MDI.serialize("{東京|とうきょう} ^12^")
let text = try MDI.renderText("# Title")
let epub: Data = try MDI.renderEPUB("# Chapter")
let docx: Data = try MDI.renderDOCX("# Chapter")
```

EPUB と DOCX は ZIP ベースの `Data` を返すため、対応する拡張子でファイルへ書き出してください。

## エラーとリリース

すべての API は `MDIError` を throw します。`core` は Rust core の失敗、`invalidWireFormat` は無効または未対応の native response を表します。CI は XCFramework をビルドし、XCTest を実行して `swift/Sources/MDI` に 90% の line coverage を要求し、Codecov へ送信します。PAT や別リポジトリは必要ありません。
