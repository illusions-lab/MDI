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
    .package(url: "https://github.com/illusions-lab/MDI.git", from: "2.0.3"),
]

// target の dependencies:
.product(name: "MDI", package: "MDI")
```

バイナリパッケージは macOS 13+、iOS 15+、Apple Silicon、および該当する Intel simulator をサポートします。

## 解析と IR

```swift
let result = try MDI.parse("# 見出し\n\n{東京|とうきょう}で第^12^話")
print(result.irVersion)          // "1.0"
print(result.capabilities.mdi)   // true
print(result.diagnostics)
```

`result.document` は可逆な `MDIJSONValue` ツリーです。`.object`、`.array`、`.string`、`.number`、`.bool`、`.null` の pattern matching で node を扱えます。`MDISourceSpan` は UTF-8 byte offset です。

## レンダリング

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

`MDITextFormat` は他の binding と同じ6種類（`plain`、`ruby`、`narou`、
`kakuyomu`、`aozora`、`note`）を Rust core から提供します。
EPUB と DOCX は ZIP ベースの `Data` を返すため、対応する拡張子でファイルへ書き出してください。

## エラー

すべての API は `MDIError` を throw します。`core` は Rust core の失敗、`invalidWireFormat` は無効または未対応の native response を表します。

```swift
do {
    let html = try MDI.renderHTML(source)
    print(html)
} catch let error as MDIError {
    print(error.localizedDescription)
}
```

## 開発とリリース

リポジトリの `swift/Package.swift` はローカル開発用パッケージです。CI は XCFramework をビルドし、XCTest を実行して `swift/Sources/MDI` に 95% の line-coverage gate を適用し、レポートを Codecov に送信します。release workflow は manifest 用の pull request を作成し、その PR がマージされた後に承認済み artifact を公開します。GitHub Actions 組み込みの token を使うため、PAT や別リポジトリは不要です。

## 割注の自動組版

分割規則は Rust が一元管理します。本文の50%の字級、固定2行、行間なしで表示します。先頭の断片には本文行の残り幅、後続には行全体の幅を指定できます。幅の単位は割注字級の半角emです。文字幅の推定であり、比例フォントの厳密な均衡は保証しません。

```swift
let fragments = try MDI.layoutWarichu(
    [.object(["type": .string("text"), "value": .string("一二三四五六")])],
    capacity: 4, firstCapacity: 2)
```

戻り値は `lines`、`html`、`widths`、`overflow`、`hardBreakAfter`、`sources` を含みます。`path` は入力配列からの子インデックス列、`startUtf8` / `endUtf8` は可視文字列内の半開UTF-8バイト範囲です。同一の `group` は書式境界をまたぐ書記素も分割しません。ルビ、縦中横、改行禁止は一体として扱います。明示改行を保ち、自動分割は正規MDIや平文に書き戻しません。静的HTML/EPUBは閲覧ソフトにより再配置が異なります。DOCXはネイティブの双行グループを使います。XMLやインポーターの検証をWordの描画実測とは記載しません。
