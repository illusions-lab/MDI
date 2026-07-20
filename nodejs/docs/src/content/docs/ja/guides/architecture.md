---
title: アーキテクチャ
description: Rust を MDI の唯一の実行可能な構文規範とし、各言語パッケージは薄いインターフェースのみを提供します。
---

`.mdi` 文書の意味は、すべて Rust が決定します。`mdi-core` が CommonMark、
GFM、フロントマター、MDI を解析し、明示的にバージョン管理された言語中立の
文書 IR を生成します。JavaScript、Python、Swift などのパッケージは、同じ
Rust 実装を各エコシステムにつなぐだけの薄いインターフェースです。

:::caution 現在の実装状態
これは製品契約の目標です。現在の Rust API は[Core API の状態](/ja/core/rust-api/)に記載しています。Node CLI と出力 package には移行中の TypeScript mdast/HAST 経路が残っていますが、独立した構文の権威ではありません。
:::

## 構文の規範

MDI には、相互に補完する 3 つの情報源があります。

1. [`SYNTAX.md`](https://github.com/illusions-lab/MDI/blob/main/SYNTAX.md) は、
   人が読むための規範的な言語仕様です。
2. `mdi-core` は、その仕様に対する唯一の実行可能な実装です。
3. 共通の conformance fixtures が、外部から観測できる構文木、診断、出力結果を
   定義します。

JavaScript、Python、Swift、CLI、エディター、レンダラーが独自に MDI 構文を
認識、修復、検証することはありません。ルビのグループ化、入れ子になった
マクロの境界、エスケープ、有効な `kern` 値などの規則は、Rust に一度だけ
実装します。

## システム構成

```text
                               .mdi source
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │ mdi-core                    │
                    │ CommonMark + GFM + MDI      │
                    │ front matter + diagnostics  │
                    └──────────────┬──────────────┘
                                   │
                        versioned MDI document IR
                                   │
             ┌─────────────────────┼──────────────────────┐
             │                     │                      │
             ▼                     ▼                      ▼
      Rust renderers        language bindings      ecosystem adapters
      MDI/TXT/HTML/          JS/Python/Swift        mdast/remark
      EPUB/DOCX              （構文なし）            （構文なし）
             │
             └── HTML + print CSS ──▶ Chromium ──▶ PDF
```

MDI の境界は Markdown の文脈に依存するため、`mdi-core` は文書全体を解析します。
分離されたテキストに対する後処理として MDI を安全に解析することはできません。

```markdown
`^12^`                 <!-- code 内ではリテラル -->
**第^12^話**           <!-- strong 内の MDI -->
[[em:**重要**]]        <!-- MDI 構造内の Markdown -->
```

このため、CommonMark、GFM、フロントマター、MDI は、Rust が管理する 1 つの
文法と 1 つの構文木を構成します。

## `mdi-core` の契約

ネイティブ Rust API とすべての言語バインディングは、概念上同じ API を公開します。

```text
parse(source, options) -> ParseResult
validate(document, options) -> diagnostics
normalize(document, options) -> document
serializeMdi(document, options) -> string
renderHtml(document, profile) -> string
renderText(document, flavor, profile) -> string
renderEpub(document, profile) -> bytes
renderDocx(document, profile) -> bytes
renderPdf(document, profile) -> bytes
```

`parse` は UTF-8 のソース全体を受け取り、ホスト言語の Markdown パーサを必要と
しません。通常の不正な入力に対しては、利用可能な構文木と診断を返します。例外は、
プログラミングエラーまたは必要なシステムリソースを利用できない場合に限ります。

### 文書 IR

公開 IR は言語中立であり、スキーマバージョンを明示します。次の情報を含みます。

- MDI 構文バージョンと IR スキーマバージョン
- 1 つの構文木に格納された、型付きの CommonMark、GFM、フロントマター、MDI ノード
- ソースに由来するすべてのノードに対する、半開区間の UTF-8 バイトスパン
- 未知のキーと記述順を維持したフロントマター
- 文書メタデータと脚注の関係
- 安定したコード、重大度、ソース位置を持つ回復可能な診断
- 正規化された `.mdi` のシリアライズとエディター機能に必要なソース情報

ブロックモデルには、段落、見出し、ブロック引用、リスト、コード、テーマ区切り、
HTML、表、脚注定義、空段落、改ページ、ブロック配置が含まれます。インラインモデル
には、テキスト、強調、太字、取り消し線、リンク、画像、コード、HTML、脚注参照、
改行、ルビ、縦中横、傍点、改行禁止、割注、カーニングが含まれます。

Rust の enum は内部実装の詳細です。FFI では安定した wire representation を交換し、
各バインディングがホスト言語に適したオブジェクトへ変換します。wire schema に
後方互換性のない変更を加える場合は、IR バージョンも更新します。

### 解析の不変条件

- Code span、fenced code、raw context 内の MDI に見える文字列はリテラルのままです。
- `SYNTAX.md` で許可されている MDI container 内には CommonMark を入れ子にできます。
- 対象となる CommonMark inline container 内には MDI node を配置できます。
- 無効または閉じられていない MDI delimiter は `SYNTAX.md` の規則に従ってリテラルへ
  フォールバックし、診断を生成する場合があります。
- すべての offset は、元入力に対する UTF-8 byte offset です。
- 同じソースとオプションは、すべてのプラットフォームで同じ IR と診断を生成します。

## レンダリング

決定的な変換はすべて Rust が実装します。

| 出力 | 実装 |
|---|---|
| 正規化 MDI | Rust serializer |
| 各種 TXT | Rust renderer |
| HTML | Rust HTML/CSS renderer |
| EPUB | Rust XHTML、metadata、CSS、ZIP packager |
| DOCX | Rust OOXML、ZIP packager |
| PDF | Rust HTML/印刷 CSS renderer、Chromium controller |

PDF では Chromium をレイアウトエンジンとして使用します。Rust が Chromium の
実行ファイルを検出または受け取り、隔離された process を起動し、Chrome DevTools
Protocol 経由で `printToPDF` を呼び出して PDF の byte 列を返します。縦書き、
ルビ、縦中横、傍点、フォント shaping、ページ分割は Chromium が担当しますが、
MDI の解析や文書の意味の決定には関与しません。

ブラウザー上の WebAssembly は process を起動できません。この環境では解析と
決定的なレンダラーをローカルで実行し、PDF は同じ Rust PDF API を実行する
サーバーまたはデスクトップホストが生成します。

## 言語バインディングとアダプター

| ホスト | インターフェース |
|---|---|
| Rust | ネイティブ crate API |
| ブラウザー JavaScript | WebAssembly |
| Node.js | 同じ wire contract に従うネイティブまたは WebAssembly binding |
| Python | PyO3 |
| Swift | UniFFI、または XCFramework として配布する小さな C ABI |

バインディングは、文字列、byte 列、エラー、オプション、オブジェクト形状を変換
できます。ただし、grammar table、tokenizer、構文 fallback、renderer の意味論を
含めることはできません。

Remark は任意のエコシステムアダプターです。Rust の文書 IR と mdast を相互変換し、
unified plugin をワークフローに組み込めるようにしますが、MDI を解析したり、MDI の
境界判定を変更したりすることはありません。主要な JavaScript API は Rust を直接
呼び出し、remark を必要としません。

## 準拠条件

次のすべてを満たす実装だけが MDI の一部として扱われます。

- すべての構文エントリーポイントが、ソース全体を `mdi-core` に渡すこと
- 公開されるすべての解析結果が、構文バージョンと IR バージョンを明示すること
- すべてのバインディングが、共通の解析・診断 fixtures にそのまま合格すること
- すべての決定的なレンダラーが Rust IR を入力として使用すること
- PDF が Rust IR から生成した HTML/CSS を使用し、Rust によって制御されること
- ホスト言語のパッケージが、別の MDI tokenizer や parser を含まないこと

完全な契約は、リポジトリルートの
[`ARCHITECTURE.md`](https://github.com/illusions-lab/MDI/blob/main/ARCHITECTURE.md)
を参照してください。
