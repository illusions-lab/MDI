---
title: 快速上手
description: 安裝 MDI 的 Node.js 套件，解析 .mdi 檔案並轉換為 HTML、PDF、EPUB 或 DOCX。
---

這是一組處理 **illusion Markdown (MDI)** 的 Node.js 套件 — MDI 是為日文小說
排版設計的 Markdown 方言。本頁介紹兩種使用方式：CLI 與程式化 API。

本工具鏈對應 **MDI 2.0**
（[規範](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)）。

## 最快的路：CLI

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

不加 `-o` 時，輸出檔會寫在輸入檔旁邊、換上對應格式的副檔名
（`novel.mdi` → `novel.pdf`）。

`txt` 輸出基本純文字；`txt-ruby` 會以 `{base|reading}` 保留ルビ。`narou`、
`kakuyomu`、`aozora` 分別輸出對應投稿平台的記法；`txt-all` 會在原稿旁一次輸出
五種文字格式，且不互相覆寫。

:::note
PDF 輸出透過 [Playwright](https://playwright.dev) 的無頭 Chromium 渲染 —
這樣 `vertical-rl`、`text-combine-upright`、`text-emphasis` 才能正確
輸出。首次使用可能需要安裝一次瀏覽器：`npx playwright install chromium`
:::

## 程式化使用

用 `@illusions-lab/mdi-remark`（單一插件，打包了 GFM + YAML front
matter + MDI 擴充）解析，再把樹交給任一轉換器：

```bash
npm install unified remark-parse @illusions-lab/mdi-remark @illusions-lab/mdi-to-html
```

```js
import { readFile } from 'node:fs/promises';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdi from '@illusions-lab/mdi-remark';
import { mdiToHtml } from '@illusions-lab/mdi-to-html';

const source = await readFile('novel.mdi', 'utf8');
const processor = unified().use(remarkParse).use(remarkMdi);
const tree = await processor.run(processor.parse(source));

const html = mdiToHtml(tree); // 完整 HTML 文件，樣式表已內嵌
```

其他轉換器形狀相同，按輸出格式挑選即可：

```js
import { mdiToPdf } from '@illusions-lab/mdi-to-pdf';   // Promise<Buffer>
import { mdiToEpub } from '@illusions-lab/mdi-to-epub'; // Promise<Buffer>
import { mdiToDocx } from '@illusions-lab/mdi-to-docx'; // Promise<Buffer>
```

四個轉換器消費的是**同一棵 mdast 樹** — 解析一次，轉換成任何格式。

## Front matter

`.mdi` 檔案可以用 YAML front matter 開頭；`remarkMdi` 會補上規範預設值
並解析到 `tree.data.frontmatter`：

```yaml
---
mdi: "2.0"
title: 吾輩は猫である
author: 夏目漱石
lang: ja
writing-mode: vertical # 或 horizontal（預設）
page-progression: rtl  # 預設跟隨 writing-mode
---
```

轉換器把它讀作文件的元資料：HTML 得到 `<title>`、`lang` 和直書
`writing-mode`；EPUB 得到 OPF 元資料；DOCX 得到文件屬性和直書
section 版面。

## 整合進既有的 remark/rehype 管線

如果你已經有一條 unified 管線（本文檔網站就是一條），不需要用轉換器 —
直接註冊語法擴充和 hast handler：

```js
import { mdi } from 'micromark-extension-mdi';
import { mdiFromMarkdown } from 'mdast-util-mdi';
import { mdiHandlers } from '@illusions-lab/mdi-to-hast';

function remarkMdiSyntax() {
	const data = this.data();
	(data.micromarkExtensions ??= []).push(mdi());
	(data.fromMarkdownExtensions ??= []).push(mdiFromMarkdown());
}
```

把 `remarkMdiSyntax` 當 remark 插件傳入、`mdiHandlers` 當
`remark-rehype` 的 handlers 傳入，再引入樣式表
（`@illusions-lab/mdi-to-hast/mdi.css` 或匯出的 `MDI_STYLESHEET`
字串）。套件之間的關係見[架構](/MDI/zh-tw/guides/architecture/)。
