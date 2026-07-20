---
title: Diagnostic と UTF-8 source span
description: 現在出力される diagnostic と byte span の正確な意味。
---

**前提:** [コア概念](/ja/learn/core-concepts/#4-diagnostics-are-data-not-exceptions)。

## 形

```ts
interface MdiDiagnostic { severity: "warning" | "error"; code: string; message: string; span?: { startByte: number; endByte: number } }
```

Diagnostic は parse 結果の `diagnostics` 配列に入るデータで、例外ではありません。不正・曖昧な MDI 記法の大半は syntax reference の literal fallback により単なるテキストとなります。

## 現在の全コード

実装されているコードは一つだけです。

### `mdi.version.unsupported`

- severity: `warning`
- front matter の `mdi:` が `MDI_SPEC_VERSION`（現在 `"2.0"`）より新しいときに出ます。
- span は front-matter block 全体です。
- message は `MDI {declared} is newer than the supported {MDI_SPEC_VERSION}` の形です。

```mdi
---
mdi: "2.1"
---
本文。
```

これは warn して継続する仕様で、文書は通常どおり木になります。現在の `mdi-core` は semver ではなく文字列比較を使用します。従って一般には `"2.10" < "2.9"` となり得る、実装上の既知の制限です。

## Span

- 単位は `parse()` に渡した元文字列の UTF-8 byte です。
- 範囲は半開区間（`startByte` は含む、`endByte` は含まない）です。
- Unicode code point、JavaScript の UTF-16 index、表示上の grapheme ではありません。

```js
function byteSpanToUtf16Index(source, byteOffset) {
  const bytes = new TextEncoder().encode(source);
  return new TextDecoder().decode(bytes.subarray(0, byteOffset)).length;
}
```

## 次へ

- [構文リファレンス](/ja/syntax/reference/)
- [Document IR](/ja/core/document-ir/)
