---
title: Remark / mdast 轉接器
description: "@illusions-lab/mdi-remark 如何將 Rust IR 對應到 mdast，以及它確切不做哪些事。"
---

**先備知識：**[Document IR](/zh-tw/core/document-ir/)、[Rust 權威架構](/zh-tw/core/architecture/)。

## Remark 是轉接器，不是解析器

`@illusions-lab/mdi-remark` 讓既有的 [unified](https://unifiedjs.com)/`remark` 管線（Astro 網站、以 `remark` 為基礎的 linter 或靜態網站產生器）以一般 `mdast` tree 使用 MDI 文件，但不把 MDI 語法的決定權交給 `remark`。重點是：**它不會為 MDI 註冊 micromark tokenizer。**其約 35 行原始碼實際做的是：

```ts
export default function remarkMdi(this: Processor): void {
	const data = this.data();
	(data.toMarkdownExtensions ??= []).push(mdiToMarkdown());
	this.use(remarkGfm);
	this.use(remarkFrontmatter, ["yaml"]);
	(this as unknown as { parser: (source: string) => Root }).parser = (source) => {
		const tree = toMdast(parse(source).document);
		resolveFrontmatter(tree);
		return tree;
	};
}
```

它會**完整替換 `Parser`**：呼叫真正的 Rust `parse()`，再將結果轉為 `mdast`。`remark-gfm` 與 `remark-frontmatter` 只用於 `mdast` → Markdown 的 stringify handlers（供寫回文字時使用）；雖然它們的 parsing hooks 有註冊，但永遠不會被到達，因為轉接器的 `parser` 函式取代了 `remark` 正常的 parse 階段。

```text
完整 .mdi 原始碼
        │
        ▼
   @illusions-lab/mdi  parse()  ── 與其他綁定相同的 Rust 呼叫
        │
        ▼
  Rust document IR  ──▶  toMdast()  ──▶  mdast tree  ──▶  你的 unified plugins
```

## 最小可執行範例

```ts
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";

const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse("{雪女|ゆき.おんな}が現れた。");

console.log(tree.children[0].children[0]);
// { type: "mdiRuby", base: "雪女", ruby: ["ゆき", "おんな"], data: {...} }
```

## 節點型別對應

MDI 自己的節點會有 `mdi` 前綴的 `mdast` 型別，避免與既有 `mdast` 慣例衝突：

| Rust IR `type` | `mdast` 型別 |
| --- | --- |
| `ruby` | `mdiRuby`（`ruby` 欄位會解除包裝為純字串或字串陣列，捨棄 `{type, value}` 包裝） |
| `tcy` | `mdiTcy` |
| `break` | `mdiBreak` |
| `em` | `mdiEm` |
| `noBreak` | `mdiNoBreak` |
| `warichu` | `mdiWarichu` |
| `kern` | `mdiKern` |
| `blank` | `mdiBlank` |
| `pagebreak` | `mdiPagebreak`（`null` variant 會完全捨棄，而非保留 `variant: null`） |
| 帶有 `indent`／`bottom` 的 `paragraph` | 一般 `paragraph`，並把 `indent`／`bottom` 移至 `data.mdiIndent`／`data.mdiBottom`；`mdast` 慣例是 renderer 專屬欄位放在 `data`，不是頂層節點欄位 |

其他節點（`heading`、`list`、`link`、`text`、GFM 表格、腳注等）不變，因為它們從 Rust 出來時已是標準 `mdast` 形狀。

## Front matter 作為結構化資料

`resolveFrontmatter` 會把原始 YAML 區塊解析為 `tree.data.frontmatter`，並填入真實預設值，而非只留下原始字串：

```ts
interface MdiFrontmatter {
  mdi: string;                              // 預設 "2.0"
  title?: string;
  author?: string;
  lang: string;                             // 預設 "ja"
  date?: string;
  writingMode: "horizontal" | "vertical"; // 預設 "horizontal"
  pageProgression: "ltr" | "rtl";         // vertical 時預設 "rtl"，否則 "ltr"
}
```

YAML 格式不正確時會退化成全預設值，而非讓 unified 管線拋出錯誤；Rust 本身的 `mdi.version.unsupported` diagnostic（見[診斷](/zh-tw/core/diagnostics/)）才是版本問題實際回報的位置，今天這個轉接器不會把它帶出來。

## 目前實作狀態：今天是單向的

解析（`.mdi` 原始碼 → `mdast`）完全由 Rust 驅動，且已實作。**寫回文字**（已編輯的 `mdast` tree → canonical `.mdi`）也透過 `mdiToMarkdown()` 實作，但它直接操作上面的 `mdast` 形狀，尚未接到 Rust 自己的 `serialize_mdi` 正規化。因此，編輯後再 stringify 的文件不保證採用 MDI 的建議形式；例如有人輸入的 `《《...》》` 別名，不會自動轉成 `[[em:...]]`，而 `@illusions-lab/mdi` 的 `serializeMdi()` 會。

## 此轉接器不做什麼

- **並非必要。**`@illusions-lab/mdi` 的 `parse()`／`renderHtml()` 等可獨立使用；只有既有 unified plugins 期待 `mdast` 時才使用此轉接器。
- **沒有自己的 MDI 文法。**若 `remarkMdi` 與 `@illusions-lab/mdi` 的 `parse()` 對同一輸入產生不同 tree，錯誤在 `toMdast()` mapping，而不是第二個 parser。
- **stringify 時不做正規化。**它不會像 Rust 的 `serialize_mdi` 一樣正規化，詳見上節。

## 下一步

- [JavaScript / TypeScript 綁定](/zh-tw/bindings/javascript/) — 此轉接器呼叫的 `parse()`／`renderHtml()`。
- [生態系：遷移與相容性](/zh-tw/ecosystem/compatibility/) — 和其他目前限制一起理解 serializer normalization 的缺口。
