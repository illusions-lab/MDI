---
title: Swift
description: Swift binding の Planned 状況。現時点で install 手順や仮 API はありません。
---

## 状況: Planned

Swift binding はまだ実装されていません。[`swift/README.md`](https://github.com/illusions-lab/MDI/blob/main/swift/README.md) も「not yet implemented」と明記しています。従って package 名、SwiftPM dependency、function signature、動作例を推測して示しません。

将来の binding は [Rust を正とする architecture](/ja/core/architecture/) に従い、`mdi-core` の grammar と versioned Document IR を呼ぶ thin interface になります。Swift 側に grammar 再実装はありません。

現在は [CLI](/ja/bindings/cli/)、[JavaScript](/ja/bindings/javascript/)、または実装済みの [Python](/ja/bindings/python/) を使ってください。status が **Implemented** になるまで Swift API を前提にした production integration は作らないでください。
