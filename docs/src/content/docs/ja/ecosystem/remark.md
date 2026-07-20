---
title: Remark / mdast アダプター
description: Rust コアで解析した MDI を unified / mdast パイプラインへ渡す
---

`@illusions-lab/mdi-remark` は、unified を利用するアプリケーション向けのアダプターである。独自の MDI パーサーは持たず、`@illusions-lab/mdi` が Rust コアで生成した文書 IR を mdast へ変換する。

## 使用例

```ts
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";

const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse("{雪女|ゆき.おんな}が現れた。");
```

## MDI ノードと mdast ノード

| Rust の文書 IR | mdast |
| --- | --- |
| `ruby`、`tcy`、`break`、`em` | `mdiRuby`、`mdiTcy`、`mdiBreak`、`mdiEm` |
| `noBreak`、`warichu`、`kern` | `mdiNoBreak`、`mdiWarichu`、`mdiKern` |
| `blank`、`pagebreak` | `mdiBlank`、`mdiPagebreak` |
| 段落の `indent` / `bottom` | `data.mdiIndent` / `data.mdiBottom` |

通常の Markdown / GFM ノードは通常の mdast 構造として返る。front matter は `tree.data.frontmatter` に構造化データとして格納される。不正な YAML は例外を発生させず、既定値へフォールバックする。

## 変換時の注意

`.mdi` から mdast への変換は Rust コアを利用する。編集後の mdast を `.mdi` へ文字列化する場合は `mdiToMarkdown()` を使用できるが、Rust の `serialize_mdi()` が行う推奨形式への正規化は適用されない。

たとえば、互換記法の `《《...》》` が `[[em:...]]` へ自動変換されることは保証されない。正規化が必要な場合は、生成した MDI を Rust の `serialize_mdi()` に渡す。

## 次のステップ

- [JavaScript / TypeScript](/ja/bindings/javascript/) — 基本 API を確認する。
- [互換性と移行](/ja/ecosystem/compatibility/) — 互換性に関する注意点を確認する。
