---
title: 快速上手
description: 使用 Rust 核心解析完整的 .mdi 文件，並輸出 HTML、PDF、EPUB、DOCX 或純文字。
---

**illusion Markdown（MDI）** 是為日文小說排版設計的 Markdown 方言。
`@illusions-lab/mdi` 是主要 JavaScript API：它把完整原始碼交給 Rust
`mdi-core`，並以同一份文件 IR 支援解析、驗證、正規化及各種輸出。

本工具鏈實作 **MDI 2.0**
（[規範](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)）。

## 最快的方式：CLI

```bash
npm install --global @illusions-lab/mdi-cli
```

```bash
mdi build novel.mdi --to html
mdi build novel.mdi --to pdf
mdi build novel.mdi --to epub -o dist/novel.epub
mdi build novel.mdi --to docx
mdi build novel.mdi --to txt
mdi build novel.mdi --to txt-ruby
mdi build novel.mdi --to narou
mdi build novel.mdi --to kakuyomu
mdi build novel.mdi --to aozora
mdi build novel.mdi --to txt-all
```

若省略 `-o`，輸出檔會寫在輸入檔旁，並使用輸出格式的副檔名
（例如 `novel.mdi` → `novel.pdf`）。

`txt` 會輸出基本純文字；`txt-ruby` 以 `{base|reading}` 保留 ruby。
`narou`、`kakuyomu` 與 `aozora` 分別使用對應投稿平台的標記格式；
`txt-all` 則一次輸出全部五種文字格式，且不會彼此覆寫。

:::note
PDF 使用 Chromium 作為排版引擎。Rust 產生 HTML 與列印 CSS、控制隔離的
Chromium process，並透過 Chrome DevTools Protocol 取得 PDF。Chromium 負責
日文直書、ruby、縱中橫、傍點、字型 shaping 與分頁，但不解析 MDI。
:::

## JavaScript API

安裝主要套件：

```bash
npm install @illusions-lab/mdi
```

`parse` 接收完整的 UTF-8 `.mdi` 原始碼，回傳文件 IR 與 diagnostics。宿主端
不需要先執行 Markdown parser，也不應先切割或改寫輸入。

```js
import { readFile } from 'node:fs/promises';
import { parse } from '@illusions-lab/mdi';

const source = await readFile('novel.mdi', 'utf8');
const { document, diagnostics } = await parse(source);

for (const diagnostic of diagnostics) {
	console.warn(
		`${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`,
	);
}
```

一般的格式錯誤不會讓整次解析失敗。Rust 會依規範產生可用的文件樹，並以具有
穩定代碼、嚴重程度及 UTF-8 byte span 的 diagnostic 說明問題。

解析結果會聲明 MDI 語法版本與 IR schema 版本。IR 中的 CommonMark、GFM、
front matter 與 MDI nodes 位於同一棵樹中；所有語言綁定看到的是同一份語義。

## 產生輸出

所有 renderer 都直接消費 `parse` 回傳的 Rust 文件 IR：

```js
import { writeFile } from 'node:fs/promises';
import {
	renderDocx,
	renderEpub,
	renderHtml,
	renderPdf,
	renderText,
	serializeMdi,
} from '@illusions-lab/mdi';

const html = await renderHtml(document);
const plainText = await renderText(document, 'plain');
const normalizedMdi = await serializeMdi(document);
const epub = await renderEpub(document);
const docx = await renderDocx(document);
const pdf = await renderPdf(document);

await Promise.all([
	writeFile('novel.html', html),
	writeFile('novel.txt', plainText),
	writeFile('novel.normalized.mdi', normalizedMdi),
	writeFile('novel.epub', epub),
	writeFile('novel.docx', docx),
	writeFile('novel.pdf', pdf),
]);
```

HTML、TXT、EPUB、DOCX 與標準化 MDI 由 Rust 直接產生。PDF 也由 Rust API
協調，只把最終排版交給 Chromium。不同輸出不會各自重新解讀原始語法。

## Front matter

`.mdi` 文件可以使用 YAML front matter：

```yaml
---
mdi: "2.0"
title: 吾輩は猫である
author: 夏目漱石
lang: ja
writing-mode: vertical # 或 horizontal（預設）
page-progression: rtl  # 預設值跟隨 writing-mode
---
```

`parse` 會在同一次 Rust 解析中處理 front matter，套用規範預設值，並保留原始
順序與未知 keys。Renderer 從文件 IR 讀取 metadata：HTML 使用 `<title>`、
`lang` 與 `writing-mode`；EPUB 使用 OPF metadata；DOCX 使用文件屬性與直書
section layout。

## 與 remark/unified 整合

Remark 是選用的生態系 adapter，不是 MDI parser。先用
`@illusions-lab/mdi` 解析完整原始碼，再把 Rust 文件 IR 映射成 mdast：

```bash
npm install @illusions-lab/mdi @illusions-lab/mdi-remark unified
```

```js
import { unified } from 'unified';
import { parse } from '@illusions-lab/mdi';
import { toMdast } from '@illusions-lab/mdi-remark';

const { document, diagnostics } = await parse(source);
const mdast = toMdast(document);
const transformed = await unified()
	.use(myRemarkPlugin)
	.run(mdast);
```

Adapter 只在 Rust IR 與 mdast 之間轉換資料。它不包含 tokenizer、grammar
table 或 fallback parser，也不能改變 MDI 的邊界判定。若要再輸出 MDI，應先
把 mdast 映射回文件 IR，再交給 Rust 的 `serializeMdi` 或其他 renderer。

套件的責任邊界與完整契約見[架構](/zh-tw/guides/architecture/)。
