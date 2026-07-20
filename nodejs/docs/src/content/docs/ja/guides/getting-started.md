---
title: はじめに
description: MDI の Node.js パッケージをインストールし、.mdi ファイルを解析して HTML・PDF・EPUB・DOCX へ変換します。
---

これは **illusion Markdown (MDI)** — 日本語小説の組版のための Markdown
方言 — を扱うパッケージ群です。このページでは CLI とプログラムからの
利用、2 つの使い方を説明します。

このツールチェーンは **MDI 2.0**
（[仕様書](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)）に対応します。

## 最短ルート: CLI

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

`-o` を省略すると、入力ファイルと同じ場所にフォーマットの拡張子で
出力されます（`novel.mdi` → `novel.pdf`）。

`txt` は基本的なプレーンテキスト、`txt-ruby` はルビを `{base|reading}` の形で
残す出力です。`narou`、`kakuyomu`、`aozora` は各投稿先向けの記法を出力します。
`txt-all` は五つのテキスト形式を、互いに上書きせず入力ファイルの隣に出力します。

:::note
PDF 出力は [Playwright](https://playwright.dev) 経由のヘッドレス Chromium
で描画します — `vertical-rl`・`text-combine-upright`・`text-emphasis` を
正しく出力するためです。初回利用時にブラウザのインストールが必要な
場合があります: `npx playwright install chromium`
:::

## プログラムからの利用

`@illusions-lab/mdi-remark`（GFM + YAML フロントマター + MDI 拡張を
まとめた単一プラグイン）で解析し、ツリーを任意のコンバータへ渡します:

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

const html = mdiToHtml(tree); // スタイルシート込みの完全な HTML ドキュメント
```

他のコンバータも同じ形で、出力フォーマットごとに選ぶだけです:

```js
import { mdiToPdf } from '@illusions-lab/mdi-to-pdf';   // Promise<Buffer>
import { mdiToEpub } from '@illusions-lab/mdi-to-epub'; // Promise<Buffer>
import { mdiToDocx } from '@illusions-lab/mdi-to-docx'; // Promise<Buffer>
```

4 つとも**同一の mdast ツリー**を消費します — 一度解析すれば、どの
フォーマットへも変換できます。

## フロントマター

`.mdi` ファイルは YAML フロントマターで始められます。`remarkMdi` が
仕様の既定値を補って `tree.data.frontmatter` に解決します:

```yaml
---
mdi: "2.0"
title: 吾輩は猫である
author: 夏目漱石
lang: ja
writing-mode: vertical # または horizontal（既定）
page-progression: rtl  # 既定値は writing-mode に従う
---
```

コンバータはこれをドキュメントのメタデータとして読みます: HTML は
`<title>`・`lang`・縦書きの `writing-mode`、EPUB は OPF メタデータ、
DOCX はドキュメントプロパティと縦書きセクションレイアウトです。

## 既存の remark/rehype パイプラインへの組み込み

すでに unified パイプラインがあるなら（このドキュメントサイトも
その一つです）、コンバータは不要です — 構文拡張と hast ハンドラを
直接登録します:

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

`remarkMdiSyntax` を remark プラグインとして、`mdiHandlers` を
`remark-rehype` のハンドラとして渡し、スタイルシート
（`@illusions-lab/mdi-to-hast/mdi.css` またはエクスポートされる
`MDI_STYLESHEET` 文字列）を読み込んでください。パッケージ間の関係は
[アーキテクチャ](/MDI/ja/guides/architecture/)を参照してください。
