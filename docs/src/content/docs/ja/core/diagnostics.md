---
title: Diagnostic と UTF-8 source span
description: 現在出力される diagnostic と byte span の正確な意味。
---

**前提:** [コア概念](/ja/learn/core-concepts/)。

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

```json
[{ "severity": "warning", "code": "mdi.version.unsupported", "message": "MDI 2.1 is newer than the supported 2.0", "span": { "startByte": 0, "endByte": 15 } }]
```

これは warn して継続する仕様で、文書は通常どおり木になります。現在の `mdi-core` は semver ではなく文字列比較を使用します。従って一般には `"2.10" < "2.9"` となり得る、実装上の既知の制限です。invalid kerning や split-ruby segment の不一致などに別 diagnostic はありません。各構文の literal fallback が意図して text として扱います。

## Span

- 単位は `parse()` に渡した元文字列の UTF-8 byte です。
- 範囲は半開区間（`startByte` は含む、`endByte` は含まない）です。
- Unicode code point、JavaScript の UTF-16 index、表示上の grapheme ではありません。

### byte span を JavaScript string index に変換する

```js
function byteSpanToUtf16Index(source, byteOffset) {
  const bytes = new TextEncoder().encode(source);
  const prefix = new TextDecoder().decode(bytes.subarray(0, byteOffset));
  return prefix.length; // JS string index に使える UTF-16 code unit index
}
```

全文を一度 encode し、byte prefix を decode して長さを取るのが簡単で正確です。文字を数えて近似しないでください。BMP 外の文字（多くの emoji や一部の漢字）は UTF-16 unit と byte の両方で複数になり、その比率は同じではありません。

## 次へ

- [構文リファレンス](/ja/syntax/reference/)
- [Document IR](/ja/core/document-ir/)
