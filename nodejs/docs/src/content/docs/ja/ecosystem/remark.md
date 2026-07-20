---
title: Remark / mdast adapter
description: @illusions-lab/mdi-remark が Rust の Document IR を mdast に渡す方法。
---

**前提:** [JavaScript binding](/ja/bindings/javascript/)。`@illusions-lab/mdi-remark` は unified user 向けの adapter で、独自 parser ではありません。`Parser` を `@illusions-lab/mdi` の real Rust `parse()` と IR→mdast 変換で置き換えます。

```ts
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";
const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse("{雪女|ゆき.おんな}が現れた。");
```

| Rust IR | mdast |
| --- | --- |
| `ruby`, `tcy`, `break`, `em` | `mdiRuby`, `mdiTcy`, `mdiBreak`, `mdiEm` |
| `noBreak`, `warichu`, `kern` | `mdiNoBreak`, `mdiWarichu`, `mdiKern` |
| `blank`, `pagebreak` | `mdiBlank`, `mdiPagebreak` |
| paragraph `indent`/`bottom` | `data.mdiIndent` / `data.mdiBottom` |

普通の Markdown/GFM node はそのまま mdast shape になります。front matter は `tree.data.frontmatter` に structured data（default `mdi: "2.0"`、`lang: "ja"`、horizontal writing 等）として置かれます。malformed YAML は throw せず default に fallback します。

## 現在の状況: one-way の注意

`.mdi` → mdast parsing は実装済みで Rust-backed です。編集後 mdast の `.mdi` stringify も `mdiToMarkdown()` でできますが、Rust `serialize_mdi` の recommended-form normalization はまだ通りません。例えば `《《...》》` を自動で `[[em:...]]` にする保証はありません。

## 次へ

- [JavaScript binding](/ja/bindings/javascript/)
- [Compatibility](/ja/ecosystem/compatibility/)
