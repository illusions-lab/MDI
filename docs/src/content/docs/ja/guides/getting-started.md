---
title: はじめに
description: MDI ファイルを作成し、CLI または JavaScript API で出力する
---

このガイドでは、`.mdi` ファイルを作成し、HTML、PDF、EPUB、DOCX、テキストへ出力する。CLI と JavaScript / TypeScript の利用には Node.js 20 以降が必要である。PDF を出力する場合は Chromium 系ブラウザも必要になる。

## 1. 原稿を作成する

次の内容で `novel.mdi` を作成する。

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

front matter は YAML 形式で記述する。`writing-mode: vertical` を指定すると、HTML 出力は縦書き用のレイアウトを使用する。記法の詳細は[構文リファレンス](/ja/syntax/reference/)を参照のこと。

## 2. CLI で変換する

CLI をインストールする。

```bash
npm install --global @illusions-lab/mdi-cli
```

HTML を出力する。

```bash
mdi build novel.mdi --to html
```

コマンドの形式は次のとおりである。

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

| オプション | 必須 | 説明 |
| --- | --- | --- |
| `<input.mdi>` | はい | 入力する UTF-8 の MDI ファイル。 |
| `--to <format>` | はい | 出力形式。 |
| `-o <path>` | いいえ | 出力先。省略時は入力ファイルと同じ場所に出力する。 |
| `--config <path>` | いいえ | エクスポートプロファイルの JSON ファイル。 |

### 出力例

```bash
mdi build novel.mdi --to html
mdi build novel.mdi --to pdf --config print.json
mdi build novel.mdi --to epub -o dist/novel.epub
mdi build novel.mdi --to docx
mdi build novel.mdi --to txt-ruby
mdi build novel.mdi --to narou
mdi build novel.mdi --to kakuyomu
mdi build novel.mdi --to aozora
```

| 形式 | 内容 |
| --- | --- |
| `html` | スタイルを含む HTML。 |
| `pdf` | Rust が生成した HTML を Chromium でページレイアウトした PDF。 |
| `epub` / `docx` | EPUB 3 / DOCX。 |
| `txt` | ルビを除いたプレーンテキスト。 |
| `txt-ruby` | ルビ記法を保持したテキスト。 |
| `narou` / `kakuyomu` / `aozora` | 各投稿先向けのテキスト。`aozora` は Shift_JIS で出力する。 |
| `txt-all` | すべてのテキスト形式を出力する。`-o` は指定できない。 |

HTML、テキスト、EPUB、DOCX は Rust コアが直接出力する。PDF では Chromium をページレイアウトのためだけに使用し、MDI ソースを Chromium に渡すことはない。

## 3. JavaScript / TypeScript から利用する

アプリケーションにパッケージを追加する。

```bash
npm install @illusions-lab/mdi
```

```ts
import { readFile } from "node:fs/promises";
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = await readFile("novel.mdi", "utf8");
const result = parse(source);

console.log(result.syntaxVersion, result.irVersion);
console.log(result.diagnostics);

const html = renderHtml(source);
```

`parse()` は文書 IR と診断情報を返す。通常の構文上の問題は、例外ではなく診断情報またはリテラルテキストとして扱われる。引数の型が不正な場合は例外となる。

`renderEpub()` と `renderDocx()` は `Uint8Array` を返す。利用可能な API とエラー処理は[JavaScript / TypeScript](/ja/bindings/javascript/)を参照のこと。

## 4. 出力設定を指定する

PDF のページサイズ、フォント、余白や、テキストの字下げはエクスポートプロファイルで設定する。

```json
{
  "typesetting": { "fontFamily": "Noto Serif JP" },
  "pagination": { "pageSize": "A4" }
}
```

```bash
mdi build novel.mdi --to pdf --config print.json
```

設定項目と出力形式ごとの対応状況は[エクスポートプロファイル](/ja/ecosystem/export-profiles/)を参照のこと。

## トラブルシューティング

### PDF の生成に失敗する

Chromium 系ブラウザが利用可能か確認する。PDF 出力では Chromium が必要である。詳細は[レンダリングモデル](/ja/core/rendering/)を参照のこと。

### コマンドが失敗する

CLI はエラーを標準エラー出力に表示し、終了コード `1` で終了する。入力パス、`--to` の値、出力先の書き込み権限を確認する。

## 次のステップ

- [CLI](/ja/bindings/cli/) — オプションと出力ファイル名を確認する。
- [JavaScript / TypeScript](/ja/bindings/javascript/) — API を利用する。
- [構文リファレンス](/ja/syntax/reference/) — 組版記法を確認する。
