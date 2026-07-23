---
title: はじめに
description: CLI と JavaScript パッケージをインストールし、実際の .mdi ファイルを HTML・PDF・テキストに変換します。
---

**前提知識:** [MDI とは？](/ja/learn/what-is-mdi/) と [コア概念](/ja/learn/core-concepts/) ―― IR・span・診断が何かを既に知っている前提です。[Node.js](https://nodejs.org) 20 以降も必要です。

このページは **MDI 2.0** を実装しています。規範的な人間向け仕様は [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) です。以下のすべてのコマンドとコードはそのままコピーして実行できます ―― このリポジトリから実際に公開されているパッケージに対して動くもので、架空のものはありません。

## 1. `.mdi` ファイルを書く

`novel.mdi` を作成します。

```mdi
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
---

# 第一章

{雪女|ゆき.おんな}が現れたのは、第^12^話のことだった。
彼は[[em:決して]]忘れないと誓った。[[br]]
その日は大安[[warichu:六曜の一つで吉日とされる]]であった。
```

## 2. CLI で変換する

CLI をグローバルにインストールします。

```bash
npm install --global @illusions-lab/mdi-cli
```

実行します。

```bash
mdi build novel.mdi --to html
```

```text
Written /path/to/novel.html
```

CLI 自身の使用方法メッセージそのままの、完全なコマンド形式です。

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

| フラグ | 意味 |
| --- | --- |
| `--to <format>` | 必須。上記のいずれかの形式。 |
| `-o <path>` | 省略可。出力パス。指定しない場合、入力ファイルのそばに形式の拡張子で保存されます ―― `novel.mdi --to pdf` は `novel.pdf` を、`--to txt-ruby` は `novel_ruby.txt` を書き出します（CLI はテキストの各バリアントを `<stem>_<variant>.txt` と命名し、プレーンな `txt` にはサフィックスがありません）。 |
| `--config <path>` | 省略可。ページサイズ、フォント、マージン、テキストの字下げを制御する[エクスポート・プロファイル](/ja/ecosystem/export-profiles/) JSON ファイルへのパス。 |

すべての出力形式を試してみます。

```bash
mdi build novel.mdi --to html                          # novel.html
mdi build novel.mdi --to pdf                            # novel.pdf
mdi build novel.mdi --to epub -o dist/novel.epub        # dist/novel.epub
mdi build novel.mdi --to docx                           # novel.docx
mdi build novel.mdi --to txt                            # novel.txt      ―― ルビは破棄
mdi build novel.mdi --to txt-ruby                       # novel_ruby.txt ―― ルビは {base|reading} として保持
mdi build novel.mdi --to narou                          # novel_narou.txt   ―― 小説家になろうの記法
mdi build novel.mdi --to kakuyomu                       # novel_kakuyomu.txt ―― カクヨムの記法
mdi build novel.mdi --to aozora                         # novel_aozora.txt  ―― 青空文庫の記法、Shift_JIS でエンコード
mdi build novel.mdi --to txt-all                        # 5 種類のテキストをすべて書き出す。-o は拒否される
```

### 各形式で実際に何が起きるか

- **HTML、TXT/`txt-ruby`/`narou`/`kakuyomu`/`aozora`、EPUB、DOCX** はすべて **Rust コアが直接**描画します（`@illusions-lab/mdi` の `renderHtml`、`renderTextFormat`、`renderEpub`、`renderDocx`）―― CLI はその間で何も再解析・再解釈しません。
- **PDF** は同じ Rust 描画の HTML を、ローカルにインストールされた Chromium 系ブラウザに渡し、そのブラウザがページ分割と `printToPDF` の呼び出しを行います。Chromium は `.mdi` ソースを一切受け取らず、構文上の判断もしません。Chromium 系ブラウザが見つからない場合、コマンドは不足している依存関係を名指しするエラーで失敗します ―― 特定の実行ファイルを指す方法は [レンダリングモデル](/ja/core/rendering/) を参照してください。
- **`aozora`** は書き出し時に **Shift_JIS** でエンコードされます。青空文庫自身の投稿ツールが期待する形式に合わせたものです。他のテキストバリアントはすべて UTF-8 で書き出されます。

### 何か問題が起きたとき

CLI はスタックトレースを表示しません。エラーは stderr へ**1行**書き出され、プロセスは終了コード `1` で終了します。

```bash
mdi build missing.mdi --to html
```

```text
ENOENT: no such file or directory, open 'missing.mdi'
```

```bash
mdi build novel.mdi --to svg
```

```text
Usage: mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

認識できない `--to` の値（や、その他の不正な引数列）は、意味を推測しようとせず、上記の使用方法を表示して終了コード `1` を返します。

## 3. JavaScript から解析・描画する

CLI に頼らずアプリケーションを構築する場合は、主要パッケージをインストールします。

```bash
npm install @illusions-lab/mdi
```

```js
import { readFile } from "node:fs/promises";
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = await readFile("novel.mdi", "utf8");

const { document, diagnostics, syntaxVersion, irVersion } = parse(source);
console.log(syntaxVersion, irVersion); // "2.0" "1.0"
console.log(diagnostics);              // このファイルには [] ―― 警告すべきものはない
console.log(document.frontmatter.entries);
// [{ key: "mdi", value: "2.0" }, { key: "title", value: "雪女" }, ...]

const html = renderHtml(source);
```

`parse` はホスト側の Markdown parser を一切必要としません ―― CommonMark、GFM、フロントマター、MDI はすべて1回の `parse` 呼び出しの中で決定されます。通常の不正な構文は利用可能な文書と（大抵は空の）診断を返します。`try`/`catch` はプログラミングエラー、例えば文字列でない値を渡した場合のためにとっておきます。

```js
parse(42); // TypeError: source must be a string を投げる
```

すべてのエクスポート関数（`renderEpub`、`renderDocx`、`renderText`、`renderTextFormat`、`serializeMdi`）の完全なシグネチャと例は [Bindings: JavaScript / TypeScript](/ja/bindings/javascript/) を参照してください。

## 4. フロントマターの解説

`novel.mdi` の先頭のフロントマターブロックは、同じ `parse()` 呼び出しの中で解析される通常の YAML です。

```yaml
---
mdi: "2.0"
title: 雪女
author: 小泉八雲
lang: ja
writing-mode: vertical
---
```

- `mdi` は文書が対象とする構文バージョンを宣言します。省略すると、パーサーは自身が対応する最新バージョンを前提とします。パーサーが対応するより*新しい*バージョンを宣言すると、`mdi.version.unsupported` という警告診断が出ます ―― 解析はベストエフォートで続行されます（[診断](/ja/core/diagnostics/)参照）。
- `writing-mode: vertical` は `renderHtml` のレイアウト方法を変えます（ルート要素に `writing-mode: vertical-rl`）。これが、縦中横や傍点がそもそも存在する理由です ―― どちらも縦書き特有の組版デバイスであり、横書きでも自然に劣化して動作します。
- キーの順序と未知のキーは `document.frontmatter.entries` に保持されます。レンダラーは認識しないキーがあってもエラーにせず無視します。

## 5. 任意: `unified`/`remark` パイプラインへの組み込み

すでに `mdast` ノードを期待する `unified` パイプライン（Astro、静的サイトジェネレーター、`remark` ベースの lint ツールなど）がある場合以外は、この節は読み飛ばしてかまいません。`@illusions-lab/mdi-remark` は**アダプター**であり第二のパーサーではありません ―― 同じ Rust の `parse()` を呼び出し、その結果を `mdast` へ整形し直すだけです。

```js
import { unified } from "unified";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkStringify from "remark-stringify";

const processor = unified().use(remarkMdi).use(remarkStringify);
const tree = processor.parse(await readFile("novel.mdi", "utf8"));
```

何が正しくラウンドトリップし、何がしないかを含む詳細は [Remark / mdast アダプター](/ja/ecosystem/remark/) にあります。

## 次のステップ

- [完全構文リファレンス](/ja/syntax/reference/) ―― 上の `novel.mdi` で使ったすべての構文を1つずつ解説します。
- [Rust 主導アーキテクチャ](/ja/core/architecture/) ―― 「文法は1つ、実装も1つ」の背後にある所有権規則。
- [エクスポート・プロファイル](/ja/ecosystem/export-profiles/) ―― `--config` でページサイズ、フォント、マージンを制御します。
