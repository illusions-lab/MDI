---
title: Remark / mdast adapter
description: "@illusions-lab/mdi-remark が Rust の Document IR を mdast に渡す方法。"
---

**前提:** [JavaScript binding](/ja/bindings/javascript/)。`@illusions-lab/mdi-remark` は unified user 向けの adapter で、独自 parser ではありません。`Parser` を `@illusions-lab/mdi` の real Rust `parse()` と IR→mdast 変換で置き換えます。

## Remark は parser ではなく adapter

`unified`/`remark` pipeline で MDI を使うときの入口です。MDI の意味を JavaScript で再解釈するのではなく、Rust が返した Document IR を標準 `mdast` と MDI 拡張 node に写します。したがって CLI や direct JavaScript API と構文の意味が分岐することはありません。

## 最小の実行例

```ts
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";
const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse("{雪女|ゆき.おんな}が現れた。");
```

`processor.parse()` が返す tree は通常の `mdast` として、次の unified plugin に渡せます。`remark-stringify` を加えれば編集後の tree を text に戻せますが、下記の one-way の注意を確認してください。

## Node type の対応

| Rust IR | mdast |
| --- | --- |
| `ruby`, `tcy`, `break`, `em` | `mdiRuby`, `mdiTcy`, `mdiBreak`, `mdiEm` |
| `noBreak`, `warichu`, `kern` | `mdiNoBreak`, `mdiWarichu`, `mdiKern` |
| `blank`, `pagebreak` | `mdiBlank`, `mdiPagebreak` |
| paragraph `indent`/`bottom` | `data.mdiIndent` / `data.mdiBottom` |

普通の Markdown/GFM node はそのまま mdast shape になります。

## Front matter は structured data

front matter は `tree.data.frontmatter` に structured data（default `mdi: "2.0"`、`lang: "ja"`、horizontal writing 等）として置かれます。malformed YAML は throw せず default に fallback します。front matter node を文字列として再解析する必要はありません。

## 現在の状況: one-way の注意

`.mdi` → mdast parsing は実装済みで Rust-backed です。編集後 mdast の `.mdi` stringify も `mdiToMarkdown()` でできますが、Rust `serialize_mdi` の recommended-form normalization はまだ通りません。例えば `《《...》》` を自動で `[[em:...]]` にする保証はありません。

## この adapter がしないこと

- **独自の MDI parser は持ちません。** Rust/CLI と結果が違えば adapter か core のバグです。
- **rendering はしません。** これは `.mdi` と `mdast` の橋渡しであり、HTML/PDF/EPUB/DOCX は各 renderer または CLI を使います。
- **Rust の normalization を補いません。** 編集済み tree を stringify する場合、canonical な recommended form が必要なら Rust の `serializeMdi()` を別途使ってください。

## 次へ

- [JavaScript binding](/ja/bindings/javascript/)
- [Compatibility](/ja/ecosystem/compatibility/)
