---
title: Swift
description: Swift binding の状態と予定契約。
---

Swift バインディングは `IllusionMarkdown` という Swift Package Manager パッケージです。小さな C ABI を通じて解析とレンダリングをすべて `mdi-core` に委譲し、Swift 側は文法やレンダリングの判断を持ちません。

リポジトリ開発時は `swift/Package.swift` がローカルのバインディング構成を提供します。`Publish Swift Package` workflow はネイティブ Rust ライブラリを XCFramework としてビルド・テストし、root の `Package.swift` を生成して tag を作成し、GitHub Actions の組み込み token で artifact をアップロードします。

同じ構文／IR バージョン、診断、UTF-8 バイトスパン、完全な文書ツリーを公開します。`MDIParseResult.document` は可逆な `MDIJSONValue` で表し、SwiftPM の配布パッケージは `IllusionMarkdown`、import module は `MDI` です。公開 API は `parse`、`renderHTML`、`serialize`、`renderText`、`renderEPUB`、`renderDOCX` です。
