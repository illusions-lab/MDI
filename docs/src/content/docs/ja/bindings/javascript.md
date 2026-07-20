---
title: JavaScript / TypeScript
description: Rust コアを利用する JavaScript / TypeScript API
---

`@illusions-lab/mdi` は、Rust 製 `mdi-core` を WebAssembly 経由で利用する JavaScript / TypeScript パッケージである。JavaScript 側に MDI 構文の再実装はない。

## インストール

```bash
npm install @illusions-lab/mdi
```

Node.js または WebAssembly を読み込めるバンドラーが必要である。WebAssembly バイナリはパッケージに含まれる。

## 解析と HTML 出力

```ts
import { parse, renderHtml } from "@illusions-lab/mdi";

const source = "第^12^話。{東京|とうきょう}は雨だった。";
const result = parse(source);

console.log(result.syntaxVersion); // "2.0"
console.log(result.irVersion);     // "1.0"
console.log(result.diagnostics);

const html = renderHtml(source);
```

`parse()` は完全なソース文字列を受け取り、文書 IR と診断情報を返す。部分文字列を単独で解析する API ではない。

## 主な API

```ts
import {
  parse,
  renderHtml,
  renderText,
  renderTextFormat,
  renderEpub,
  renderDocx,
  serializeMdi,
  MDI_SPEC_VERSION,
  MDI_IR_VERSION,
} from "@illusions-lab/mdi";
```

| API | 戻り値 | 用途 |
| --- | --- | --- |
| `parse(source)` | 解析結果 | 文書 IR と診断情報を取得する。 |
| `renderHtml(source)` | `string` | HTML を生成する。 |
| `renderText(source)` | `string` | プレーンテキストを生成する。 |
| `renderTextFormat(source, format)` | `string` | `txt-ruby`、`narou`、`kakuyomu`、`aozora` などを生成する。 |
| `renderEpub(source)` | `Uint8Array` | EPUB を生成する。 |
| `renderDocx(source)` | `Uint8Array` | DOCX を生成する。 |
| `serializeMdi(source)` | `string` | 正規化された MDI / Markdown を生成する。 |

各出力 API は内部で完全な解析を行う。JavaScript API には、解析済み IR を渡して複数形式を出力する API はない。

## エラーと診断

`source` に文字列以外を渡した場合は `TypeError` となる。パッケージと WebAssembly の IR バージョンが一致しない場合は `Error` となる。

通常の不正な MDI 記法は例外ではなく、リテラルテキストへのフォールバックまたは `diagnostics` として扱われる。`span` は UTF-8 のバイトオフセットであり、JavaScript の文字列インデックスではない。

## 制限事項

PDF を生成する API は提供していない。ブラウザ WebAssembly は Chromium を起動できないため、PDF には CLI または Node.js ホスト上の `@illusions-lab/mdi-to-pdf` を使用する。

EPUB と DOCX は基本出力に対応する。エクスポートプロファイルのカバー、章分割、ページ設定などには未対応の項目がある。

## 次のステップ

- [ドキュメント IR](/ja/core/document-ir/) — `parse()` の戻り値を確認する。
- [Remark / mdast アダプター](/ja/ecosystem/remark/) — unified と連携する。
- [CLI](/ja/bindings/cli/) — PDF を含むファイル変換を行う。
