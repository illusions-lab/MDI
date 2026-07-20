---
title: はじめに
description: Rust コアで .mdi 文書全体を解析し、HTML・PDF・EPUB・DOCX・プレーンテキストを生成します。
---

**illusion Markdown（MDI）** は、日本語小説の組版のための Markdown 方言です。
`@illusions-lab/mdi` は主要な JavaScript API です。完全なソースを Rust の
`mdi-core` に渡し、同じ文書 IR を使って解析、検証、正規化、各形式への出力を
行います。

このツールチェーンは **MDI 2.0**
（[仕様書](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md)）を実装します。

## 最短ルート：CLI

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

`-o` を省略すると、入力ファイルと同じ場所に出力形式の拡張子で保存されます
（例：`novel.mdi` → `novel.pdf`）。

`txt` は基本的なプレーンテキストを出力し、`txt-ruby` はルビを
`{base|reading}` の形で残します。`narou`、`kakuyomu`、`aozora` はそれぞれの
投稿先に対応した記法を出力します。`txt-all` は 5 種類すべてのテキスト形式を、
互いに上書きせず一度に生成します。

:::note
PDF は Chromium をレイアウトエンジンとして使用します。Rust が HTML と印刷
CSS を生成し、隔離された Chromium process を制御して、Chrome DevTools
Protocol 経由で PDF を取得します。Chromium は縦書き、ルビ、縦中横、傍点、
フォント shaping、ページ分割を担当しますが、MDI の解析は行いません。
:::

## JavaScript API

主要パッケージをインストールします。

```bash
npm install @illusions-lab/mdi
```

`parse` は UTF-8 の `.mdi` ソース全体を受け取り、文書 IR と診断を返します。
ホスト側で Markdown parser を先に実行したり、入力を分割・書き換えたりする必要は
ありません。

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

通常の不正な入力によって解析全体が失敗することはありません。Rust は仕様に従って
利用可能な文書ツリーを生成し、安定したコード、重大度、UTF-8 byte span を持つ
診断で問題を報告します。

解析結果は MDI 構文バージョンと IR schema バージョンを明示します。CommonMark、
GFM、フロントマター、MDI の各 node は同じツリーに格納されるため、すべての言語
バインディングが同じ意味を共有します。

## 出力の生成

すべての renderer は、`parse` が返す Rust 文書 IR を直接受け取ります。

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

HTML、TXT、EPUB、DOCX、正規化された MDI は Rust が直接生成します。PDF も
Rust API が処理全体を制御し、最終的なレイアウトだけを Chromium に委ねます。
出力形式ごとに元の構文を解釈し直すことはありません。

## フロントマター

`.mdi` 文書は YAML フロントマターで始めることができます。

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

`parse` は同じ Rust 解析の中でフロントマターを処理し、仕様の既定値を適用しながら、
記述順と未知の key を保持します。Renderer は文書 IR の metadata を参照します。
HTML は `<title>`、`lang`、`writing-mode`、EPUB は OPF metadata、DOCX は
文書プロパティと縦書き section layout に反映します。

## remark/unified との統合

Remark は任意のエコシステムアダプターであり、MDI parser ではありません。
まず `@illusions-lab/mdi` で完全なソースを解析し、Rust 文書 IR を mdast に
変換します。

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

アダプターが行うのは Rust IR と mdast の間のデータ変換だけです。tokenizer、
grammar table、fallback parser は含まず、MDI の境界判定を変更することもできません。
MDI として再出力する場合は、mdast を文書 IR に戻してから、Rust の
`serializeMdi` または各 renderer に渡します。

パッケージの責務と完全な契約については、
[アーキテクチャ](/ja/guides/architecture/)を参照してください。
